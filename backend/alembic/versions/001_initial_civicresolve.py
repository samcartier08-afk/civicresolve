"""Initial CivicResolve PostGIS + pgvector + Job Queue schema

Revision ID: 001_initial_civicresolve
Revises:
Create Date: 2026-11-21
"""
from __future__ import annotations

from alembic import op

revision = "001_initial_civicresolve"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS civic_incidents (
            id SERIAL PRIMARY KEY,
            tracking_code VARCHAR(32) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            category_group VARCHAR(64) NOT NULL,
            category VARCHAR(64) NOT NULL,
            priority VARCHAR(24) NOT NULL DEFAULT 'Medium',
            urgency_score INTEGER NOT NULL DEFAULT 50,
            severity DOUBLE PRECISION NOT NULL DEFAULT 0.5,
            safety_risk DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            status VARCHAR(32) NOT NULL DEFAULT 'Reported',
            department_name VARCHAR(160) NOT NULL,
            ward_code VARCHAR(32) NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            location GEOGRAPHY(Point, 4326) NOT NULL,
            report_count INTEGER NOT NULL DEFAULT 1,
            unique_citizen_count INTEGER NOT NULL DEFAULT 1,
            text_embedding vector(768),
            image_embedding vector(768),
            is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ix_civic_incidents_location_gist
            ON civic_incidents USING GIST (location);
        CREATE INDEX IF NOT EXISTS ix_civic_incidents_text_vec_hnsw
            ON civic_incidents USING hnsw (text_embedding vector_cosine_ops);
        CREATE INDEX IF NOT EXISTS ix_civic_incidents_status_dept_created
            ON civic_incidents (status, department_name, created_at);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS civic_incidents CASCADE;")
