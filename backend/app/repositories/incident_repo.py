from __future__ import annotations

import time
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AuditLog, CitizenReport, CivicIncident, JobQueue, StatusHistory

# In-process TTL cache for heavy admin dashboard SQL aggregates
_AGGREGATE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 15.0


class IncidentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_report_and_enqueue_job(
        self,
        *,
        tracking_id: str,
        idempotency_key: str,
        reporter_uid: str,
        is_anonymous: bool,
        anonymous_token: str | None,
        title: str,
        description: str,
        landmark: str,
        ward_code: str,
        latitude: float,
        longitude: float,
        location_consent: bool,
        media_object_names: list[str],
    ) -> CitizenReport:
        existing = (
            await self._session.execute(
                select(CitizenReport).where(CitizenReport.idempotency_key == idempotency_key)
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing

        report = CitizenReport(
            tracking_id=tracking_id,
            idempotency_key=idempotency_key,
            reporter_uid=reporter_uid,
            is_anonymous=is_anonymous,
            anonymous_tracking_token=anonymous_token,
            title=title,
            description=description,
            landmark=landmark,
            ward_code=ward_code,
            latitude=latitude,
            longitude=longitude,
            location=f"SRID=4326;POINT({longitude} {latitude})",
            location_consent=location_consent,
            media_object_names=media_object_names,
            ai_status="queued",
        )
        self._session.add(report)
        await self._session.flush()

        job = JobQueue(report_id=report.id, status="pending")
        self._session.add(job)
        await self._session.commit()
        return report

    async def list_incidents_keyset(
        self,
        *,
        cursor_created_at: datetime | None = None,
        cursor_id: int | None = None,
        status_filter: str | None = None,
        department_filter: str | None = None,
        ward_filter: str | None = None,
        priority_filter: str | None = None,
        limit: int = 25,
    ) -> list[CivicIncident]:
        """Keyset pagination with `selectinload` eager loading (zero N+1 queries)."""
        stmt = (
            select(CivicIncident)
            .options(
                selectinload(CivicIncident.reports),
                selectinload(CivicIncident.status_history),
            )
            .order_by(CivicIncident.created_at.desc(), CivicIncident.id.desc())
            .limit(min(100, limit))
        )
        if status_filter:
            stmt = stmt.where(CivicIncident.status == status_filter)
        if department_filter:
            stmt = stmt.where(CivicIncident.department_name == department_filter)
        if ward_filter:
            stmt = stmt.where(CivicIncident.ward_code == ward_filter)
        if priority_filter:
            stmt = stmt.where(CivicIncident.priority == priority_filter)
        if cursor_created_at is not None and cursor_id is not None:
            stmt = stmt.where(
                (CivicIncident.created_at < cursor_created_at)
                | (
                    (CivicIncident.created_at == cursor_created_at)
                    & (CivicIncident.id < cursor_id)
                )
            )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def compute_dashboard_sql_aggregates(self) -> dict[str, Any]:
        """Computes all admin metrics via SQL `GROUP BY` aggregates with brief in-process TTL cache."""
        now = time.monotonic()
        cached = _AGGREGATE_CACHE.get("admin_agg")
        if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

        status_rows = (
            await self._session.execute(
                select(CivicIncident.status, func.count(CivicIncident.id)).group_by(
                    CivicIncident.status
                )
            )
        ).all()
        dept_rows = (
            await self._session.execute(
                select(CivicIncident.department_name, func.count(CivicIncident.id)).group_by(
                    CivicIncident.department_name
                )
            )
        ).all()
        ward_rows = (
            await self._session.execute(
                select(CivicIncident.ward_code, func.count(CivicIncident.id)).group_by(
                    CivicIncident.ward_code
                )
            )
        ).all()
        prio_rows = (
            await self._session.execute(
                select(CivicIncident.priority, func.count(CivicIncident.id)).group_by(
                    CivicIncident.priority
                )
            )
        ).all()

        payload: dict[str, Any] = {
            "by_status": {str(k): int(v) for k, v in status_rows},
            "by_department": {str(k): int(v) for k, v in dept_rows},
            "by_ward": {str(k): int(v) for k, v in ward_rows},
            "by_priority": {str(k): int(v) for k, v in prio_rows},
        }
        _AGGREGATE_CACHE["admin_agg"] = (now, payload)
        return payload

    async def transition_incident_status(
        self,
        *,
        incident_id: int,
        new_status: str,
        actor_uid: str,
        actor_role: str,
        public_comment: str,
        internal_note: str | None = None,
        priority_override: str | None = None,
        priority_override_reason: str | None = None,
        evidence_object_names: list[str] | None = None,
    ) -> CivicIncident | None:
        incident = await self._session.get(CivicIncident, incident_id)
        if incident is None:
            return None

        prev_status = incident.status
        incident.status = new_status

        if priority_override and priority_override != incident.priority:
            old_prio = incident.priority
            incident.priority = priority_override
            self._session.add(
                AuditLog(
                    actor_uid=actor_uid,
                    actor_role=actor_role,
                    action="PRIORITY_OVERRIDE",
                    target_type="civic_incident",
                    target_id=incident.tracking_code,
                    details={
                        "previous_priority": old_prio,
                        "new_priority": priority_override,
                        "reason": priority_override_reason or "Authority override",
                    },
                )
            )

        self._session.add(
            StatusHistory(
                incident_id=incident.id,
                prev_status=prev_status,
                new_status=new_status,
                actor_uid=actor_uid,
                actor_role=actor_role,
                public_comment=public_comment,
                internal_note=internal_note,
                evidence_object_names=evidence_object_names or [],
            )
        )
        await self._session.commit()
        _AGGREGATE_CACHE.clear()
        return incident
