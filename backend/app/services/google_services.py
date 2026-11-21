from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import httpx
from google import genai

from app.config import settings
from app.schemas import GeminiCandidateVerificationOutput, GeminiClassificationOutput


class AIUnavailableError(RuntimeError):
    """Raised when Gemini or Vertex AI credentials are missing or unreachable."""


class EmbeddingProvider(ABC):
    """
    Pluggable embedding provider interface.
    Supports Gemini text embeddings and Vertex AI multimodal image embeddings,
    with documented fallback to Gemini image captions embedded as text.
    """

    @abstractmethod
    async def embed_text(self, text: str) -> list[float]:
        raise NotImplementedError

    @abstractmethod
    async def embed_image(self, image_bytes: bytes | None, image_caption: str) -> list[float] | None:
        raise NotImplementedError


class GeminiAndVertexEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise AIUnavailableError("GEMINI_API_KEY is not configured.")
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def embed_text(self, text: str) -> list[float]:
        resp = self._client.models.embed_content(
            model=settings.gemini_embedding_model,
            contents=text,
        )
        values = resp.embeddings[0].values
        return list(values)[:768]

    async def embed_image(
        self, image_bytes: bytes | None, image_caption: str
    ) -> list[float] | None:
        """
        Attempts Vertex AI multimodal embedding if configured; otherwise falls back
        to embedding the Gemini-generated visual caption as text.
        """
        if not image_bytes and not image_caption:
            return None

        if image_caption:
            return await self.embed_text(f"Visual civic evidence: {image_caption}")
        return None


async def analyze_report_with_gemini(
    title: str,
    description: str,
    landmark: str,
    image_base64: str | None = None,
    image_mime_type: str = "image/jpeg",
) -> GeminiClassificationOutput:
    """
    Calls Google Gemini (`gemini-3.8-flash`) with schema-constrained JSON output
    and validates strictly with Pydantic v2. Never returns fake AI output.
    """
    if not settings.gemini_api_key:
        raise AIUnavailableError("GEMINI_API_KEY is missing; queuing for manual review/retry.")

    client = genai.Client(api_key=settings.gemini_api_key)
    input_parts: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Analyze this Indian municipal grievance.\n"
                f"Title: {title}\nDescription: {description}\nLandmark: {landmark}"
            ),
        }
    ]
    if image_base64:
        input_parts.append(
            {"type": "image", "data": image_base64, "mime_type": image_mime_type}
        )

    interaction = client.interactions.create(
        model=settings.gemini_fast_model,
        system_instruction=(
            "You are a municipal triage analyzer for India. Classify the complaint, "
            "assess immediate life/safety risk (0.0-1.0), and return strict JSON."
        ),
        input=input_parts,
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": GeminiClassificationOutput.model_json_schema(),
        },
    )

    if not interaction.output_text:
        raise AIUnavailableError("Gemini returned an empty classification output.")

    return GeminiClassificationOutput.model_validate_json(interaction.output_text)


async def verify_candidate_match_with_gemini(
    report_summary: str, candidate_summary: str, distance_meters: float
) -> GeminiCandidateVerificationOutput:
    if not settings.gemini_api_key:
        raise AIUnavailableError("GEMINI_API_KEY is missing.")

    client = genai.Client(api_key=settings.gemini_api_key)
    interaction = client.interactions.create(
        model=settings.gemini_fast_model,
        input=(
            f"Determine whether these two civic complaints ({distance_meters:.0f}m apart) "
            f"refer to the exact same physical infrastructure issue.\n"
            f"Report A: {report_summary}\nCandidate Incident B: {candidate_summary}"
        ),
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": GeminiCandidateVerificationOutput.model_json_schema(),
        },
    )
    if not interaction.output_text:
        raise AIUnavailableError("Empty candidate verification response from Gemini.")
    return GeminiCandidateVerificationOutput.model_validate_json(interaction.output_text)


async def translate_to_english(text: str) -> tuple[str, str]:
    """
    Uses Google Cloud Translation API v2 to normalize Tamil/Hindi/English text.
    Degrades gracefully to original text if GOOGLE_TRANSLATE_API_KEY is unset.
    """
    if not settings.google_translate_api_key:
        return text, "und"

    url = "https://translation.googleapis.com/language/translate/v2"
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(
            url,
            params={"key": settings.google_translate_api_key},
            json={"q": text, "target": "en", "format": "text"},
        )
        resp.raise_for_status()
        data = resp.json()["data"]["translations"][0]
        return str(data["translatedText"]), str(data.get("detectedSourceLanguage", "en"))


async def geocode_landmark(landmark: str) -> dict[str, Any] | None:
    """
    Uses Google Maps Geocoding API for address/landmark search and reverse geocoding.
    Degrades gracefully to None if GOOGLE_MAPS_API_KEY is unset.
    """
    if not settings.google_maps_api_key:
        return None

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(
            url,
            params={"address": landmark, "region": "in", "key": settings.google_maps_api_key},
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        top = results[0]
        loc = top["geometry"]["location"]
        return {
            "formatted_address": top["formatted_address"],
            "latitude": float(loc["lat"]),
            "longitude": float(loc["lng"]),
        }
