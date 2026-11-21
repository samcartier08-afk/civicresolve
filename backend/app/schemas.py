from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LifecycleStatus = Literal[
    "Reported",
    "AI Analyzed",
    "Matched/Created",
    "Under Review",
    "Assigned",
    "Accepted",
    "In Progress",
    "Resolved",
    "Citizen Verified",
    "Closed",
    "Rejected",
    "Escalated",
    "Reopened",
    "Awaiting Info",
    "needs_manual_review",
]

PriorityLevel = Literal["Low", "Medium", "High", "Critical"]


class GeminiClassificationOutput(BaseModel):
    """Schema-constrained JSON output validated with Pydantic v2."""

    model_config = ConfigDict(extra="forbid")

    category_group: Literal[
        "Roads & Potholes",
        "Waste & Sanitation",
        "Streetlights & Electricity",
        "Water & Drainage",
        "Public Safety",
        "Parks & Environment",
        "Other",
    ]
    category: str = Field(min_length=2, max_length=64)
    severity: float = Field(ge=0.0, le=1.0)
    safety_risk: float = Field(
        ge=0.0,
        le=1.0,
        description="Immediate life/safety hazard score (e.g. >= 0.9 for exposed live wire or open manhole).",
    )
    image_caption: str = Field(default="", max_length=400)
    normalized_english_summary: str = Field(min_length=5, max_length=400)
    recommended_department: str = Field(min_length=3, max_length=160)
    confidence: float = Field(ge=0.0, le=1.0)


class GeminiCandidateVerificationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_same_physical_incident: bool
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(max_length=300)


class ReportCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10, max_length=4000)
    landmark: str = Field(min_length=3, max_length=200)
    ward_code: str = Field(default="GCC-W101", max_length=32)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    location_consent: bool = True
    is_anonymous: bool = False
    media_object_names: list[str] = Field(default_factory=list, max_length=4)


class ReportCreateResponse(BaseModel):
    tracking_id: str
    processing_status: str
    anonymous_tracking_token: str | None = None
    persisted_at: datetime


class StatusTransitionRequest(BaseModel):
    new_status: LifecycleStatus
    public_comment: str = Field(default="", max_length=500)
    internal_note: str | None = Field(default=None, max_length=500)
    priority_override: PriorityLevel | None = None
    priority_override_reason: str | None = Field(default=None, max_length=300)
    evidence_object_names: list[str] = Field(default_factory=list, max_length=4)


class CitizenResolutionActionRequest(BaseModel):
    action: Literal["confirm", "dispute"]
    comment: str = Field(default="", max_length=500)
    anonymous_tracking_token: str | None = None
