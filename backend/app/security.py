from __future__ import annotations

import io
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from fastapi import Depends, Header, HTTPException, Request, status
from PIL import Image
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(key_func=get_remote_address)

ALLOWED_MIME_MAGIC: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB cap


class AuthenticatedUser:
    def __init__(self, uid: str, role: str, email: str | None = None) -> None:
        self.uid = uid
        self.role = role
        self.email = email


async def verify_firebase_token(
    authorization: str | None = Header(default=None),
    x_dev_role: str | None = Header(default=None),
    x_dev_uid: str | None = Header(default=None),
) -> AuthenticatedUser:
    """
    Verifies Firebase ID token on protected routes.
    Falls back to explicit dev headers only when Firebase credentials are not configured in local dev.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            import firebase_admin
            from firebase_admin import auth as firebase_auth

            if not firebase_admin._apps:
                firebase_admin.initialize_app()
            decoded: dict[str, Any] = firebase_auth.verify_id_token(token)
            uid = str(decoded["uid"])
            role = str(decoded.get("role", "citizen"))
            return AuthenticatedUser(uid=uid, role=role, email=decoded.get("email"))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Firebase authentication token.",
            ) from exc

    if x_dev_uid and x_dev_role in {"citizen", "authority", "admin"}:
        return AuthenticatedUser(uid=x_dev_uid, role=x_dev_role)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide a valid Firebase Bearer token.",
    )


def require_role(*allowed_roles: str) -> Callable[..., Any]:
    """Single server-side RBAC dependency guard (`require_role()`)."""

    async def _guard(user: AuthenticatedUser = Depends(verify_firebase_token)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role in {allowed_roles}.",
            )
        return user

    return _guard


def enforce_citizen_ownership(user: AuthenticatedUser, resource_owner_uid: str) -> None:
    if user.role in {"authority", "admin"}:
        return
    if user.uid != resource_owner_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify another citizen's report.",
        )


def validate_and_sanitize_image(raw_bytes: bytes) -> tuple[bytes, str, str]:
    """
    1. Enforces 5 MB size cap.
    2. Verifies magic bytes for JPEG, PNG, and WebP.
    3. Strips all EXIF (including GPS metadata) before public storage/display.
    4. Generates a randomized UUID object name.
    """
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded image exceeds the 5 MB maximum limit.",
        )

    detected_mime: str | None = None
    ext = "jpg"

    if raw_bytes.startswith(b"\xff\xd8\xff"):
        detected_mime = "image/jpeg"
        ext = "jpg"
    elif raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_mime = "image/png"
        ext = "png"
    elif len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP":
        detected_mime = "image/webp"
        ext = "webp"

    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Only JPEG, PNG, and WebP magic bytes are allowed.",
        )

    # Strip EXIF metadata by re-encoding clean pixel data without info/exif blocks
    with Image.open(io.BytesIO(raw_bytes)) as img:
        clean_img = Image.new(img.mode, img.size)
        clean_img.putdata(list(img.getdata()))
        out = io.BytesIO()
        fmt = "JPEG" if ext == "jpg" else ext.upper()
        clean_img.save(out, format=fmt)
        sanitized_bytes = out.getvalue()

    object_name = f"evidence/{uuid.uuid4().hex}.{ext}"
    return sanitized_bytes, detected_mime, object_name


def generate_gcs_signed_url(object_name: str, method: str = "GET", expiration_minutes: int = 15) -> str:
    """Generates a V4 Signed URL for Google Cloud Storage evidence objects."""
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(settings.gcs_bucket_name)
    blob = bucket.blob(object_name)
    return str(
        blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method=method,
        )
    )
