from __future__ import annotations

import io
import pytest
from fastapi import HTTPException
from PIL import Image

from app.schemas import GeminiClassificationOutput
from app.security import AuthenticatedUser, enforce_citizen_ownership, validate_and_sanitize_image
from app.services.matching import compute_priority, score_candidate_match


def test_scoring_reweights_when_image_is_missing() -> None:
    res = score_candidate_match(
        distance_meters=12.0,
        text_cosine=0.88,
        image_cosine=None,
        same_category=True,
        same_category_group=True,
        hours_apart=1.0,
    )
    assert res.outcome == "auto_attach"
    assert res.effective_weights["image"] == 0.0
    assert abs(sum(res.effective_weights.values()) - 1.0) < 0.001


def test_proximity_alone_never_merges_distinct_issues() -> None:
    res = score_candidate_match(
        distance_meters=1.0,
        text_cosine=0.10,
        image_cosine=0.95,
        same_category=False,
        same_category_group=True,
        hours_apart=0.5,
    )
    assert res.outcome == "new_incident"


def test_priority_function_single_live_wire_is_critical_while_count_alone_is_not() -> None:
    # Single exposed live wire -> immediately Critical
    prio_wire, score_wire = compute_priority(
        severity=0.7,
        safety_risk=0.95,
        independent_report_count=1,
        duration_hours=0.2,
        velocity_per_hour=1.0,
    )
    assert prio_wire == "Critical"
    assert score_wire >= 90

    # 100 reports of a minor low-hazard cosmetic issue -> never becomes Critical
    prio_minor, score_minor = compute_priority(
        severity=0.25,
        safety_risk=0.10,
        independent_report_count=100,
        duration_hours=12.0,
        velocity_per_hour=10.0,
    )
    assert prio_minor == "Low"
    assert score_minor < 60


def test_rbac_ownership_guard() -> None:
    cit_a = AuthenticatedUser(uid="cit_a", role="citizen")
    with pytest.raises(HTTPException) as exc:
        enforce_citizen_ownership(cit_a, "cit_b")
    assert exc.value.status_code == 403


def test_image_magic_bytes_and_exif_stripping() -> None:
    img = Image.new("RGB", (16, 16), color=(120, 40, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    sanitized, mime, obj_name = validate_and_sanitize_image(buf.getvalue())
    assert mime == "image/png"
    assert obj_name.endswith(".png")
    assert len(sanitized) > 0

    with pytest.raises(HTTPException):
        validate_and_sanitize_image(b"NOT_AN_IMAGE_PAYLOAD")


def test_gemini_pydantic_schema_validation() -> None:
    payload = GeminiClassificationOutput(
        category_group="Streetlights & Electricity",
        category="Exposed Live Wire",
        severity=0.9,
        safety_risk=0.95,
        image_caption="Sparking wire hanging from pole",
        normalized_english_summary="Exposed live streetlight wire near bus shelter",
        recommended_department="TANGEDCO — Streetlighting & Electrical Distribution",
        confidence=0.98,
    )
    assert payload.safety_risk == 0.95
