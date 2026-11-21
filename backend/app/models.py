from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from geoalchemy2 import Geography
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(24), default="citizen", index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="Citizen")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JurisdictionRule(Base):
    __tablename__ = "jurisdiction_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ward_code: Mapped[str] = mapped_column(String(32), index=True)
    ward_name: Mapped[str] = mapped_column(String(128))
    zone_name: Mapped[str] = mapped_column(String(128))
    category_group: Mapped[str] = mapped_column(String(64), index=True)
    department_name: Mapped[str] = mapped_column(String(160))
    sla_hours: Mapped[int] = mapped_column(Integer, default=24)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)


class CivicIncident(Base):
    """Master clustered incident (`civic_incidents`)."""

    __tablename__ = "civic_incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracking_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    category_group: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    priority: Mapped[str] = mapped_column(String(24), default="Medium", index=True)
    urgency_score: Mapped[int] = mapped_column(Integer, default=50)
    severity: Mapped[float] = mapped_column(Float, default=0.5)
    safety_risk: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="Reported", index=True)
    department_name: Mapped[str] = mapped_column(String(160), index=True)
    ward_code: Mapped[str] = mapped_column(String(32), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location: Mapped[Any] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    unique_citizen_count: Mapped[int] = mapped_column(Integer, default=1)
    text_embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    image_embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    reports: Mapped[list[CitizenReport]] = relationship(
        back_populates="incident", lazy="selectin"
    )
    status_history: Mapped[list[StatusHistory]] = relationship(
        back_populates="incident", lazy="selectin", order_by="StatusHistory.created_at"
    )

    __table_args__ = (
        Index("ix_civic_incidents_location_gist", "location", postgresql_using="gist"),
        Index(
            "ix_civic_incidents_text_vec_hnsw",
            "text_embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"text_embedding": "vector_cosine_ops"},
        ),
        Index("ix_civic_incidents_status_dept_created", "status", "department_name", "created_at"),
    )


class CitizenReport(Base):
    """Immutable original citizen report (`citizen_reports`). Never deleted on merge."""

    __tablename__ = "citizen_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tracking_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    incident_id: Mapped[int | None] = mapped_column(
        ForeignKey("civic_incidents.id"), nullable=True, index=True
    )
    reporter_uid: Mapped[str] = mapped_column(String(128), index=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    anonymous_tracking_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    normalized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_language: Mapped[str] = mapped_column(String(16), default="en")
    landmark: Mapped[str] = mapped_column(String(200))
    ward_code: Mapped[str] = mapped_column(String(32), default="GCC-W101")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location: Mapped[Any] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    location_consent: Mapped[bool] = mapped_column(Boolean, default=True)
    media_object_names: Mapped[list[str]] = mapped_column(JSONB, default=list)
    text_embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    image_embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    match_outcome: Mapped[str] = mapped_column(String(32), default="pending")
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ai_status: Mapped[str] = mapped_column(String(32), default="queued")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    incident: Mapped[CivicIncident | None] = relationship(back_populates="reports")

    __table_args__ = (
        Index("ix_citizen_reports_location_gist", "location", postgresql_using="gist"),
        UniqueConstraint("idempotency_key", name="uq_citizen_reports_idempotency"),
    )


class StatusHistory(Base):
    """Audit row on every lifecycle transition (`status_history`)."""

    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("civic_incidents.id"), index=True)
    prev_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    new_status: Mapped[str] = mapped_column(String(32))
    actor_uid: Mapped[str] = mapped_column(String(128))
    actor_role: Mapped[str] = mapped_column(String(24))
    public_comment: Mapped[str] = mapped_column(Text, default="")
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_object_names: Mapped[list[str]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    incident: Mapped[CivicIncident] = relationship(back_populates="status_history")


class JobQueue(Base):
    """Postgres-backed job queue processed with `FOR UPDATE SKIP LOCKED`."""

    __tablename__ = "job_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("citizen_reports.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_uid: Mapped[str] = mapped_column(String(128), index=True)
    actor_role: Mapped[str] = mapped_column(String(24))
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
