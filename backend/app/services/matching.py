from __future__ import annotations

import math
from dataclasses import dataclass

from app.config import settings
from app.schemas import PriorityLevel


@dataclass(frozen=True)
class CandidateScoreResult:
    total_score: float
    outcome: str  # "auto_attach" | "possible_match" | "new_incident"
    location_score: float
    text_score: float
    image_score: float | None
    category_score: float
    time_score: float
    effective_weights: dict[str, float]


def score_candidate_match(
    *,
    distance_meters: float,
    text_cosine: float,
    image_cosine: float | None,
    same_category: bool,
    same_category_group: bool,
    hours_apart: float,
) -> CandidateScoreResult:
    """
    Computes weighted multimodal similarity score across available signals.
    Base weights: location 35, text 30, image 20, category 10, time 5.
    Missing image is never disqualifying (weights renormalize over available signals).
    Proximity alone NEVER merges if category group or text semantics conflict.
    """
    if distance_meters > settings.candidate_radius_meters or not same_category_group:
        return CandidateScoreResult(
            total_score=0.0,
            outcome="new_incident",
            location_score=0.0,
            text_score=text_cosine,
            image_score=image_cosine,
            category_score=0.0,
            time_score=0.0,
            effective_weights={},
        )

    loc_score = max(0.0, math.exp(-distance_meters / 180.0))
    txt_score = max(0.0, min(1.0, text_cosine))
    cat_score = 1.0 if same_category else 0.5
    time_score = max(0.0, math.exp(-abs(hours_apart) / 72.0))

    raw_weights = {
        "location": settings.weight_location,
        "text": settings.weight_text,
        "image": settings.weight_image if image_cosine is not None else 0.0,
        "category": settings.weight_category,
        "time": settings.weight_time,
    }
    weight_sum = sum(raw_weights.values()) or 1.0
    eff = {k: round(v / weight_sum, 4) for k, v in raw_weights.items()}

    img_val = max(0.0, min(1.0, image_cosine)) if image_cosine is not None else 0.0

    # Guardrail: Image similarity cannot merge when text semantics are incoherent
    if image_cosine is not None and txt_score < 0.25:
        img_val = min(img_val, 0.25)

    total = (
        loc_score * eff["location"]
        + txt_score * eff["text"]
        + img_val * eff["image"]
        + cat_score * eff["category"]
        + time_score * eff["time"]
    )

    # Guardrail: Proximity alone never merges without semantic text agreement
    if txt_score < 0.22:
        total = min(total, settings.threshold_medium - 0.05)

    total = round(max(0.0, min(1.0, total)), 4)

    if total >= settings.threshold_high:
        outcome = "auto_attach"
    elif total >= settings.threshold_medium:
        outcome = "possible_match"
    else:
        outcome = "new_incident"

    return CandidateScoreResult(
        total_score=total,
        outcome=outcome,
        location_score=round(loc_score, 4),
        text_score=round(txt_score, 4),
        image_score=round(img_val, 4) if image_cosine is not None else None,
        category_score=round(cat_score, 4),
        time_score=round(time_score, 4),
        effective_weights=eff,
    )


def compute_priority(
    *,
    severity: float,
    safety_risk: float,
    independent_report_count: int,
    duration_hours: float,
    velocity_per_hour: float,
) -> tuple[PriorityLevel, int]:
    """
    Priority = f(severity, safety_risk, independent_report_count, duration, velocity).
    - A single exposed live wire (`safety_risk >= 0.85`) is immediately Critical.
    - Report count alone NEVER makes a low-hazard issue Critical.
    """
    if safety_risk >= 0.85:
        score = min(99, int(88 + safety_risk * 10 + min(3, independent_report_count)))
        return "Critical", score

    base = severity * 55.0 + safety_risk * 30.0
    volume_boost = min(10.0, math.log2(max(1, independent_report_count) + 1) * 2.5)
    duration_boost = min(6.0, duration_hours / 24.0)
    velocity_boost = min(6.0, velocity_per_hour * 1.5)

    raw_score = int(round(base + volume_boost + duration_boost + velocity_boost))

    # Enforce hazard ceiling so report volume alone never escalates to Critical
    if safety_risk < 0.35 and severity < 0.45:
        capped = min(54, max(15, raw_score))
        return "Low", capped
    if safety_risk < 0.65 and severity < 0.70:
        capped = min(74, max(45, raw_score))
        return "Medium", capped

    capped = min(89, max(70, raw_score))
    return "High", capped


def build_geocell_advisory_lock_key(latitude: float, longitude: float, category_group: str) -> str:
    """Builds deterministic geohash-cell + category_group key for `pg_advisory_xact_lock`."""
    lat_cell = round(latitude * 200)
    lng_cell = round(longitude * 200)
    return f"cell_{lat_cell}_{lng_cell}_{category_group.lower().replace(' ', '_')}"
