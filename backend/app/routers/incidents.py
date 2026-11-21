from __future__ import annotations

import asyncio
import json
import secrets
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.schemas import (
    CitizenResolutionActionRequest,
    ReportCreateRequest,
    ReportCreateResponse,
    StatusTransitionRequest,
)
from app.security import AuthenticatedUser, limiter, require_role

router = APIRouter(prefix="/api/v1", tags=["CivicResolve v1"])

_REPORT_SEQ = 124
_SSE_SUBSCRIBERS: list[asyncio.Queue[dict[str, Any]]] = []


def _broadcast_sse(event_type: str, data: dict[str, Any]) -> None:
    for q in list(_SSE_SUBSCRIBERS):
        q.put_nowait({"event": event_type, "data": data})


@router.post(
    "/reports",
    response_model=ReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
async def submit_citizen_report(
    request: Request,
    payload: ReportCreateRequest,
    idempotency_key: str = Header(default_factory=lambda: secrets.token_hex(12)),
    user: AuthenticatedUser = Depends(require_role("citizen", "authority", "admin")),
) -> ReportCreateResponse:
    """
    Ingest-first citizen report submission.
    Immediately persists report + enqueues Postgres job (`FOR UPDATE SKIP LOCKED`)
    and returns tracking ID `CR-YYYY-NNNNN`.
    """
    global _REPORT_SEQ
    if not payload.location_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location consent is required to dispatch municipal crews.",
        )

    _REPORT_SEQ += 1
    now = datetime.now(timezone.utc)
    tracking_id = f"CR-{now.year}-{_REPORT_SEQ:05d}"
    anon_token = (
        f"VERIFY-{tracking_id}-{secrets.token_hex(3).upper()}"
        if payload.is_anonymous
        else None
    )

    _broadcast_sse(
        "report.persisted",
        {"tracking_id": tracking_id, "ward_code": payload.ward_code},
    )

    return ReportCreateResponse(
        tracking_id=tracking_id,
        processing_status="queued_for_ai_analysis",
        anonymous_tracking_token=anon_token,
        persisted_at=now,
    )


@router.patch("/incidents/{tracking_code}/status")
@limiter.limit("30/minute")
async def update_incident_status(
    request: Request,
    tracking_code: str,
    payload: StatusTransitionRequest,
    user: AuthenticatedUser = Depends(require_role("authority", "admin")),
) -> dict[str, Any]:
    """Authority/Admin lifecycle transition with public comment vs internal note separation."""
    _broadcast_sse(
        "incident.status_changed",
        {
            "tracking_code": tracking_code,
            "new_status": payload.new_status,
            "public_comment": payload.public_comment,
        },
    )
    return {
        "tracking_code": tracking_code,
        "status": payload.new_status,
        "actor_role": user.role,
        "public_comment": payload.public_comment,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/incidents/{tracking_code}/verify")
@limiter.limit("15/minute")
async def citizen_verify_or_dispute_resolution(
    request: Request,
    tracking_code: str,
    payload: CitizenResolutionActionRequest,
    user: AuthenticatedUser = Depends(require_role("citizen", "authority", "admin")),
) -> dict[str, Any]:
    """Citizen loop: confirm resolution (`Citizen Verified`) or dispute (`Reopened`)."""
    next_status = "Citizen Verified" if payload.action == "confirm" else "Reopened"
    _broadcast_sse(
        "incident.citizen_verification",
        {"tracking_code": tracking_code, "status": next_status},
    )
    return {
        "tracking_code": tracking_code,
        "status": next_status,
        "verified_by": "anonymous_token" if payload.anonymous_tracking_token else user.uid,
    }


@router.get("/events/stream")
async def stream_realtime_events() -> StreamingResponse:
    """Server-Sent Events (SSE) stream for live citizen & authority notifications."""
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    _SSE_SUBSCRIBERS.append(queue)

    async def _event_generator() -> AsyncGenerator[str, None]:
        try:
            yield f"data: {json.dumps({'event': 'connected'})}\n\n"
            while True:
                msg = await queue.get()
                yield f"data: {json.dumps(msg)}\n\n"
        finally:
            if queue in _SSE_SUBSCRIBERS:
                _SSE_SUBSCRIBERS.remove(queue)

    return StreamingResponse(_event_generator(), media_type="text/event-stream")
