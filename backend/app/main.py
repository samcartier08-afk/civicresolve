from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.routers.incidents import router as incidents_router
from app.security import limiter

app = FastAPI(
    title="CivicResolve API",
    description=(
        "AI civic grievance & incident-clustering platform for India "
        "(FastAPI + PostGIS + pgvector + Google Gemini)."
    ),
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Dev-Role", "X-Dev-Uid"],
)


@app.middleware("http")
async def security_headers_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    return response


app.include_router(incidents_router)


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, object]:
    return {
        "ok": True,
        "service": "CivicResolve FastAPI Backend",
        "gemini_configured": bool(settings.gemini_api_key),
        "maps_configured": bool(settings.google_maps_api_key),
        "translation_configured": bool(settings.google_translate_api_key),
    }
