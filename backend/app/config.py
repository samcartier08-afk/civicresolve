from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://civic:civic@localhost:5432/civicresolve",
    )
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_fast_model: str = os.getenv("GEMINI_FAST_MODEL", "gemini-3.8-flash")
    gemini_embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
    vertex_project_id: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")
    vertex_location: str = os.getenv("VERTEX_AI_LOCATION", "asia-south1")
    google_maps_api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    google_translate_api_key: str = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
    gcs_bucket_name: str = os.getenv("GCS_BUCKET_NAME", "civicresolve-evidence")
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "civicresolve-india")
    cors_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ALLOW_ORIGINS", "http://localhost:3000,http://localhost:5173"
            ).split(",")
            if origin.strip()
        ]
    )

    # Configurable IGMER Incident Matching Weights & Thresholds
    weight_location: float = float(os.getenv("MATCH_WEIGHT_LOCATION", "35.0"))
    weight_text: float = float(os.getenv("MATCH_WEIGHT_TEXT", "30.0"))
    weight_image: float = float(os.getenv("MATCH_WEIGHT_IMAGE", "20.0"))
    weight_category: float = float(os.getenv("MATCH_WEIGHT_CATEGORY", "10.0"))
    weight_time: float = float(os.getenv("MATCH_WEIGHT_TIME", "5.0"))

    threshold_high: float = float(os.getenv("MATCH_THRESHOLD_HIGH", "0.75"))
    threshold_medium: float = float(os.getenv("MATCH_THRESHOLD_MEDIUM", "0.50"))
    candidate_radius_meters: float = float(os.getenv("CANDIDATE_RADIUS_METERS", "500.0"))
    candidate_time_window_hours: int = int(os.getenv("CANDIDATE_TIME_WINDOW_HOURS", "168"))
    max_worker_retries: int = int(os.getenv("MAX_WORKER_RETRIES", "5"))


settings = Settings()
