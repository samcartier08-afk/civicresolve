-- ============================================================================
-- CivicResolve — IGMER (Ingest-First Geospatial Multimodal Entity Resolution)
-- PostgreSQL + PostGIS + pgvector Transactional Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Master Incidents Table (Clustered physical civic incidents)
CREATE TABLE IF NOT EXISTS master_incidents (
    incident_id VARCHAR(32) PRIMARY KEY,
    title TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    priority VARCHAR(16) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    urgency_score INTEGER NOT NULL CHECK (urgency_score BETWEEN 1 AND 100),
    recommended_department VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'Reported' CHECK (status IN ('Reported', 'In Progress', 'Resolved')),
    centroid_location GEOGRAPHY(Point, 4326) NOT NULL,
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lng DOUBLE PRECISION NOT NULL,
    spread_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
    supporting_report_count INTEGER NOT NULL DEFAULT 1,
    unique_citizen_count INTEGER NOT NULL DEFAULT 1,
    supporting_photographs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_classification_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    matching_confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    text_embedding vector(64),
    image_embedding vector(64),
    earliest_report_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latest_report_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_incidents_geo
    ON master_incidents USING GIST (centroid_location);

CREATE INDEX IF NOT EXISTS idx_master_incidents_text_vec
    ON master_incidents USING hnsw (text_embedding vector_cosine_ops);

-- 2. Citizen Reports Table (Ingest-First immutable citizen submissions)
CREATE TABLE IF NOT EXISTS citizen_reports (
    report_id VARCHAR(32) PRIMARY KEY,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    master_incident_id VARCHAR(32) REFERENCES master_incidents(incident_id),
    reporter_id VARCHAR(128) NOT NULL,
    reporter_name VARCHAR(128) NOT NULL,
    raw_title TEXT NOT NULL,
    raw_description TEXT NOT NULL,
    normalized_text TEXT,
    location_text TEXT NOT NULL,
    report_location GEOGRAPHY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    user_category VARCHAR(64) NOT NULL DEFAULT 'Auto',
    resolved_category VARCHAR(64),
    image_url TEXT,
    text_embedding vector(64),
    image_embedding vector(64),
    ingestion_status VARCHAR(32) NOT NULL DEFAULT 'PERSISTED',
    matching_outcome VARCHAR(32) CHECK (matching_outcome IN ('AUTO_LINKED', 'REVIEW_REQUIRED', 'NEW_INCIDENT', 'PENDING')),
    matching_score DOUBLE PRECISION,
    similarity_breakdown JSONB,
    stage_telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_geo
    ON citizen_reports USING GIST (report_location);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_incident
    ON citizen_reports (master_incident_id);

-- 3. Transactional Outbox Table (Written in the same DB transaction as citizen_reports)
CREATE TABLE IF NOT EXISTS transactional_outbox (
    event_id VARCHAR(48) PRIMARY KEY,
    report_id VARCHAR(32) NOT NULL REFERENCES citizen_reports(report_id) ON DELETE CASCADE,
    event_type VARCHAR(48) NOT NULL DEFAULT 'REPORT_INGESTED',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'RETRY_SCHEDULED', 'REVIEW_QUEUE', 'DEAD_LETTER')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_poll
    ON transactional_outbox (status, next_retry_at);

-- 4. Concurrency-Safe Locality Advisory Lock Helper
-- Uses pg_advisory_xact_lock on a 64-bit hash of the geospatial grid cell
-- so concurrent workers in the same locality serialize ONLY the short matching transaction.
CREATE OR REPLACE FUNCTION acquire_igmer_locality_lock(cell_key TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(cell_key, 2026));
END;
$$ LANGUAGE plpgsql;
