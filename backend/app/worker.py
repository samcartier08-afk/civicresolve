from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import CitizenReport, CivicIncident, JobQueue, StatusHistory
from app.services.google_services import (
    AIUnavailableError,
    GeminiAndVertexEmbeddingProvider,
    analyze_report_with_gemini,
    translate_to_english,
)
from app.services.matching import (
    build_geocell_advisory_lock_key,
    compute_priority,
    score_candidate_match,
)


async def poll_and_process_next_job(session: AsyncSession) -> bool:
    """
    Polls the Postgres-backed job queue using `FOR UPDATE SKIP LOCKED`.
    Never holds database locks while calling Gemini or embedding APIs.
    On max retries, marks report `needs_manual_review` so citizen never resubmits.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(JobQueue)
        .where(
            JobQueue.status.in_(["pending", "retry"]),
            JobQueue.next_run_at <= now,
        )
        .order_by(JobQueue.next_run_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if job is None:
        return False

    job.status = "processing"
    job.attempts += 1
    report = await session.get(CitizenReport, job.report_id)
    if report is None:
        job.status = "completed"
        await session.commit()
        return True

    report_snapshot = {
        "id": report.id,
        "title": report.title,
        "description": report.description,
        "landmark": report.landmark,
        "ward_code": report.ward_code,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "reporter_uid": report.reporter_uid,
        "created_at": report.created_at,
    }
    # Commit `processing` claim before external AI network calls so no DB locks are held
    await session.commit()

    try:
        normalized_text, detected_lang = await translate_to_english(
            f"{report_snapshot['title']}. {report_snapshot['description']}"
        )
        classification = await analyze_report_with_gemini(
            title=report_snapshot["title"],
            description=normalized_text,
            landmark=report_snapshot["landmark"],
        )
        embedder = GeminiAndVertexEmbeddingProvider()
        text_vec = await embedder.embed_text(classification.normalized_english_summary)
        image_vec = await embedder.embed_image(None, classification.image_caption)
    except AIUnavailableError as exc:
        await _handle_worker_failure(session, job.id, report_snapshot["id"], str(exc))
        return True
    except Exception as exc:
        await _handle_worker_failure(session, job.id, report_snapshot["id"], str(exc))
        return True

    # Short controlled critical section protected by transaction-level advisory lock per geo-cell
    lock_key = build_geocell_advisory_lock_key(
        report_snapshot["latitude"],
        report_snapshot["longitude"],
        classification.category_group,
    )
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_key, 2026))"),
        {"lock_key": lock_key},
    )

    # Candidate retrieval: PostGIS ST_DWithin + same category_group + time window + pgvector top-K
    window_start = datetime.now(timezone.utc) - timedelta(
        hours=settings.candidate_time_window_hours
    )
    candidate_sql = text(
        """
        SELECT id,
               ST_Distance(
                   location,
                   ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
               ) AS distance_meters,
               1 - (text_embedding <=> CAST(:vec AS vector)) AS text_cosine,
               category,
               created_at
        FROM civic_incidents
        WHERE category_group = :cat_group
          AND created_at >= :window_start
          AND ST_DWithin(
              location,
              ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
              :radius
          )
        ORDER BY text_embedding <=> CAST(:vec AS vector)
        LIMIT 5
        """
    )
    rows = (
        await session.execute(
            candidate_sql,
            {
                "lat": report_snapshot["latitude"],
                "lng": report_snapshot["longitude"],
                "vec": str(text_vec),
                "cat_group": classification.category_group,
                "window_start": window_start,
                "radius": settings.candidate_radius_meters,
            },
        )
    ).mappings().all()

    best_incident_id: int | None = None
    best_result = None

    for row in rows:
        hours_apart = (
            datetime.now(timezone.utc) - row["created_at"]
        ).total_seconds() / 3600.0
        scored = score_candidate_match(
            distance_meters=float(row["distance_meters"]),
            text_cosine=float(row["text_cosine"] or 0.0),
            image_cosine=None,
            same_category=(row["category"] == classification.category),
            same_category_group=True,
            hours_apart=hours_apart,
        )
        if best_result is None or scored.total_score > best_result.total_score:
            best_result = scored
            best_incident_id = int(row["id"])

    db_report = await session.get(CitizenReport, report_snapshot["id"])
    db_job = await session.get(JobQueue, job.id)
    if db_report is None or db_job is None:
        await session.commit()
        return True

    db_report.normalized_text = normalized_text
    db_report.detected_language = detected_lang
    db_report.text_embedding = text_vec
    db_report.image_embedding = image_vec
    db_report.ai_status = "analyzed"

    if best_result and best_incident_id and best_result.outcome in {"auto_attach", "possible_match"}:
        incident = await session.get(CivicIncident, best_incident_id)
        if incident is not None:
            incident.report_count += 1
            priority, urgency = compute_priority(
                severity=max(incident.severity, classification.severity),
                safety_risk=max(incident.safety_risk, classification.safety_risk),
                independent_report_count=incident.report_count,
                duration_hours=1.0,
                velocity_per_hour=float(incident.report_count),
            )
            incident.priority = priority
            incident.urgency_score = urgency
            db_report.incident_id = incident.id
            db_report.match_outcome = best_result.outcome
            db_report.match_score = best_result.total_score
    else:
        priority, urgency = compute_priority(
            severity=classification.severity,
            safety_risk=classification.safety_risk,
            independent_report_count=1,
            duration_hours=0.1,
            velocity_per_hour=1.0,
        )
        new_incident = CivicIncident(
            tracking_code=db_report.tracking_id,
            title=db_report.title,
            category_group=classification.category_group,
            category=classification.category,
            priority=priority,
            urgency_score=urgency,
            severity=classification.severity,
            safety_risk=classification.safety_risk,
            status="Matched/Created",
            department_name=classification.recommended_department,
            ward_code=db_report.ward_code,
            latitude=db_report.latitude,
            longitude=db_report.longitude,
            location=f"SRID=4326;POINT({db_report.longitude} {db_report.latitude})",
            report_count=1,
            unique_citizen_count=1,
            text_embedding=text_vec,
            image_embedding=image_vec,
        )
        session.add(new_incident)
        await session.flush()
        db_report.incident_id = new_incident.id
        db_report.match_outcome = "new_incident"
        db_report.match_score = 1.0

        session.add(
            StatusHistory(
                incident_id=new_incident.id,
                prev_status="Reported",
                new_status="Matched/Created",
                actor_uid="system_worker",
                actor_role="system",
                public_comment=f"Routed to {classification.recommended_department}.",
                internal_note=f"Gemini confidence={classification.confidence:.2f}",
            )
        )

    db_job.status = "completed"
    await session.commit()
    return True


async def _handle_worker_failure(
    session: AsyncSession, job_id: int, report_id: int, error_msg: str
) -> None:
    db_job = await session.get(JobQueue, job_id)
    db_report = await session.get(CitizenReport, report_id)
    if db_job is None or db_report is None:
        return

    db_job.last_error = error_msg
    if db_job.attempts >= db_job.max_attempts:
        db_job.status = "needs_manual_review"
        db_report.ai_status = "needs_manual_review"
    else:
        db_job.status = "retry"
        backoff_seconds = min(300, 5 * (2 ** (db_job.attempts - 1)))
        db_job.next_run_at = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)

    await session.commit()
