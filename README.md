# CivicResolve — AI-Powered Civic Issue Platform with IGMER Algorithm

**CivicResolve** simplifies how citizens report local infrastructure issues and helps municipal authorities classify, cluster, prioritize, route, and resolve them transparently using **Google Gemini** (`@google/genai`) and **IGMER (Ingest-First Geospatial Multimodal Entity Resolution)**.

---

## Custom Core Algorithm: IGMER (Ingest-First Geospatial Multimodal Entity Resolution)

Implemented in [`src/lib/igmer-engine.ts`](src/lib/igmer-engine.ts), [`db/schema.sql`](db/schema.sql), [`src/app/api/igmer/route.ts`](src/app/api/igmer/route.ts), and interactive UI [`src/components/IgmerLabTab.tsx`](src/components/IgmerLabTab.tsx):

### Priority 1 — Citizen Submission Reliability (Ingest-First + Transactional Outbox)
- **Zero AI Dependency on Submission:** Citizen complaints are validated, deduplicated via `Idempotency-Key`, assigned a unique `RPT-2026-xxxx` ID, and committed atomically alongside a `REPORT_INGESTED` event in the **Transactional Outbox** (`transactional_outbox`) before returning an immediate `201 Created` response.
- **Retries, Failure Recovery & Dead-Letter Queue:** Background outbox workers process Gemini analysis, embeddings, and incident matching asynchronously with exponential backoff and dead-letter (`DEAD_LETTER`) protection.

### Priority 2 — 10-Stage Multimodal Incident Entity Resolution
1. **Multilingual Text Normalization** (English + transliterated Indian civic lexicon: *sadak/gaddha*, *paani/kuzhai*, *kachra/kuppa*, *batti/vilakku*, *naali*).
2. **Text Embedding Generation** (`vector(64)` semantic concept & n-gram hashing / Gemini embedding).
3. **Image Embedding Generation** when photographs exist.
4. **Geographic Coordinate Normalization** (WGS84 `GEOGRAPHY(Point, 4326)`).
5. **Category Classification** (Gemini `gemini-3.8-flash` structured JSON + deterministic fallback).
6. **Temporal Feature Extraction** (72-hour exponential decay).
7. **Geographic Candidate Filtering** (PostGIS `ST_DWithin` / Haversine radial filter).
8. **Semantic Candidate Retrieval** (`pgvector` `<=>` cosine similarity).
9. **Multimodal Similarity Scoring with Adaptive Weight Normalization:**
   - Base weights: **Geographic 35%** · **Text 30%** · **Image 20%** · **Category 10%** · **Time 5%**.
   - When photographs are missing, weights adaptively normalize across available evidence (`Geo 43.75%`, `Text 37.5%`, `Category 12.5%`, `Time 6.25%`).
   - **Guardrails:** Never merges on GPS proximity alone (incompatible category/text vetoes merge), and image similarity cannot independently establish that two photographs depict the same object without text/category corroboration.
10. **Three Configurable Matching Outcomes:**
    - **High Confidence (`>= 0.75`):** `AUTO_LINKED` to existing Master Incident.
    - **Medium Confidence (`0.50 – 0.74`):** `REVIEW_REQUIRED` (queued for human confirmation/split).
    - **Low Confidence (`< 0.50`):** `NEW_INCIDENT` (`INC-2026-xxxx`).

### Priority 3 — Concurrency-Safe Incident Clustering
- **No Locks Held During Gemini or Image Processing:** All AI and embedding work runs outside the critical section.
- **Per-Locality Advisory Locks (`pg_advisory_xact_lock` / `withLocalityAdvisoryLock`):** Workers acquire a short lock on the geospatial cell key, **re-check candidate master incidents inside the protected transaction**, and atomically link or create the master incident.

### Priority 4 — Master Incident Aggregation & Volume-Safe Priority
- Each Master Incident aggregates supporting citizen report count, unique citizen count, supporting photographs, geographic centroid & spread radius (m), earliest/latest timestamps, AI & matching confidence, and full independently accessible report history.
- **Volume-Safe Priority Ceiling:** Repeated reports boost evidence confidence and impact estimation, but report volume alone never escalates a minor cosmetic issue into an emergency `Critical` priority.

### Priority 5 & 6 — Independent Failure Isolation & 50-Citizen Automated Load Tests
- Independent stage isolation for Image, Gemini, Embeddings, and Matching.
- Automated tests (`npm test` — **25/25 passing tests**) + live in-browser **50-Citizen Concurrency Stress Simulator** testing:
  - 50 simultaneous citizens reporting 1 physical incident → **1 Master Incident** (0 race duplicates).
  - 50 simultaneous reports for 2 co-located incidents at identical GPS coordinates (25 Pothole + 25 Broken Streetlight) → **2 distinct Master Incidents**.
  - 50 simultaneous reports under Gemini, Image, Embedding, Duplicate Request, and DB retry faults → **100% submission preservation**.

---

## Local Verification
```powershell
npm test
npm run typecheck
npm run build
npm run dev
```
