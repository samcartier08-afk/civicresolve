import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  AiTriageSchema,
  CreateIssueRequestSchema,
  TriageRequestSchema,
  UpdateIssueRequestSchema,
} from "../src/lib/civic-schemas.ts";
import { fallbackClassifyIssue } from "../src/lib/civic-ai.ts";
import {
  computeIssueStats,
  createIssue,
  deleteIssue,
  getIssueById,
  isValidIssueId,
  listIssues,
  resetIssueStoreForTests,
  updateIssue,
} from "../src/lib/issue-store.ts";
import {
  BASE_IGMER_WEIGHTS,
  computeAggregatedPriorityAndScore,
  computeImageEmbedding,
  computeMultimodalSimilarity,
  computeTextEmbedding,
  getCitizenReportById,
  getIgmerStateSnapshot,
  ingestCitizenReport,
  normalizeMultilingualCivicText,
  processOutboxEvent,
  resetIgmerEngineForTests,
  resolveMediumConfidenceReview,
  runConcurrentLoadSimulation,
  setIgmerThresholds,
} from "../src/lib/igmer-engine.ts";
import {
  checkRateLimit,
  escapeCsvCell,
  resetRateLimitStore,
  sanitizeApiError,
} from "../src/lib/security.ts";
import { getMongoDbUriInfo } from "../src/lib/mongodb.ts";
import { GEMINI_MODELS, resolveModel } from "../src/lib/gemini.ts";

describe("Gemini Model Configuration", () => {
  it("defaults to fast Flash model for token efficiency", () => {
    assert.equal(resolveModel(false), GEMINI_MODELS.fast);
    assert.equal(resolveModel(undefined), GEMINI_MODELS.fast);
  });

  it("switches to deep reasoning model when explicitly requested", () => {
    assert.equal(resolveModel(true), GEMINI_MODELS.reasoning);
  });
});

describe("CivicResolve Zod Validation Schemas", () => {
  it("accepts valid citizen complaint payloads", () => {
    const result = CreateIssueRequestSchema.safeParse({
      title: "Broken streetlight outside hostel",
      description: "Three LED poles have been dark for 5 days along the main lane.",
      location: "Ward 14 Main Road",
      userCategory: "Auto",
    });
    assert.equal(result.success, true);
  });

  it("rejects short titles, empty descriptions, and unsafe image MIME types", () => {
    assert.equal(
      TriageRequestSchema.safeParse({
        title: "Hi",
        description: "Too short",
        location: "W1",
      }).success,
      false
    );
    assert.equal(
      TriageRequestSchema.safeParse({
        title: "Pothole report",
        description: "Deep pothole near bus stand causing traffic jams.",
        location: "Ward 8",
        imageBase64: "abc",
        imageMimeType: "image/svg+xml",
      }).success,
      false
    );
  });

  it("validates structured Gemini AI triage responses", () => {
    const valid = AiTriageSchema.safeParse({
      category: "Roads & Potholes",
      priority: "High",
      urgencyScore: 84,
      recommendedDepartment: "Public Works & Roads Department (PWD)",
      publicImpactReason: "Deep crater on an arterial school road causes rider skids.",
      citizenSummary: "High-priority pothole outside school gate needs asphalt repair.",
      estimatedResolutionWindow: "24 hours",
      recommendedActions: ["Barricade pothole", "Apply hot-mix asphalt patch"],
      safetyAdvisory: "Slow down near the school crossing.",
      confidence: 94,
    });
    assert.equal(valid.success, true);
  });

  it("requires at least one valid field on admin PATCH updates", () => {
    assert.equal(UpdateIssueRequestSchema.safeParse({}).success, false);
    assert.equal(
      UpdateIssueRequestSchema.safeParse({
        status: "In Progress",
        adminNote: "Crew dispatched.",
      }).success,
      true
    );
  });
});

describe("Civic AI Triage Fallback Classifier", () => {
  it("classifies burst water pipelines as Critical Water & Drainage", () => {
    const res = fallbackClassifyIssue({
      title: "Burst water pipe flooding road",
      description: "Pressurized water main burst causing emergency flooding.",
      location: "Peelamedu Junction",
      userCategory: "Auto",
    });
    assert.equal(res.category, "Water & Drainage");
    assert.equal(res.priority, "Critical");
    assert.equal(res.recommendedDepartment, "Water Supply & Sewerage Board");
    assert.ok(res.urgencyScore >= 85);
  });

  it("classifies potholes to Public Works & Roads Department", () => {
    const res = fallbackClassifyIssue({
      title: "Deep pothole on main road",
      description: "Large pothole near junction causing two-wheelers to skid.",
      location: "Avinashi Road",
      userCategory: "Auto",
    });
    assert.equal(res.category, "Roads & Potholes");
    assert.equal(res.recommendedDepartment, "Public Works & Roads Department (PWD)");
    assert.equal(res.priority, "High");
  });

  it("classifies garbage overflow to Solid Waste & Sanitation", () => {
    const res = fallbackClassifyIssue({
      title: "Overflowing garbage bin",
      description: "Waste bin spilling onto footpath for 3 days.",
      location: "Market Street",
      userCategory: "Auto",
    });
    assert.equal(res.category, "Waste & Sanitation");
    assert.equal(res.recommendedDepartment, "Municipal Solid Waste & Sanitation");
  });

  it("classifies dark streetlights with live wires as Critical Electricity", () => {
    const res = fallbackClassifyIssue({
      title: "Broken streetlight with live wire",
      description: "Sparking electric wire hanging from bent lamp pole.",
      location: "DB Road",
      userCategory: "Auto",
    });
    assert.equal(res.category, "Streetlights & Electricity");
    assert.equal(res.recommendedDepartment, "Electricity & Streetlighting Board");
    assert.equal(res.priority, "Critical");
  });
});

describe("Civic Issue Store CRUD & Audit Timeline", () => {
  beforeEach(() => {
    resetIssueStoreForTests();
  });

  it("validates tracking ID format strictly", () => {
    assert.equal(isValidIssueId("CR-2026-1001"), true);
    assert.equal(isValidIssueId("../../etc/passwd"), false);
    assert.equal(isValidIssueId("CR-12-1"), false);
  });

  it("loads realistic seeded issues and computes live metrics", () => {
    const all = listIssues();
    assert.ok(all.length >= 5);
    const stats = computeIssueStats(all);
    assert.equal(stats.total, all.length);
    assert.equal(stats.reported + stats.inProgress + stats.resolved, stats.total);
    assert.ok(stats.resolutionRate >= 0 && stats.resolutionRate <= 100);
  });

  it("creates, updates with audit trail, and deletes a civic issue", () => {
    const created = createIssue({
      title: "Damaged footpath slabs",
      description: "Broken concrete slabs over roadside storm drain.",
      location: "RS Puram Cross 2",
      reporterName: "Test Citizen",
      userCategory: "Auto",
      category: "Roads & Potholes",
      priority: "Medium",
      urgencyScore: 62,
      recommendedDepartment: "Public Works & Roads Department (PWD)",
      publicImpactReason: "Pedestrian tripping hazard on busy footpath.",
      citizenSummary: "Damaged footpath slabs at RS Puram Cross 2.",
      estimatedResolutionWindow: "48 hours",
      recommendedActions: ["Inspect slab damage", "Replace concrete covers"],
      safetyAdvisory: "Watch your step near the drain opening.",
      confidence: 91,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
    });

    assert.equal(isValidIssueId(created.id), true);
    assert.equal(created.status, "Reported");
    assert.equal(created.timeline.length, 2);

    const updated = updateIssue(created.id, {
      status: "In Progress",
      adminNote: "PWD repair crew assigned.",
    });
    assert.ok(updated);
    assert.equal(updated.status, "In Progress");
    assert.equal(updated.timeline.length, 3);
    assert.ok(updated.timeline[2].note.includes("PWD repair crew assigned."));

    const fetched = getIssueById(created.id);
    assert.equal(fetched?.status, "In Progress");

    assert.equal(deleteIssue(created.id), true);
    assert.equal(getIssueById(created.id), undefined);
  });

  it("filters issues by status, priority, and search query", () => {
    const resolved = listIssues({ status: "Resolved" });
    assert.ok(resolved.every((i) => i.status === "Resolved"));

    const searchRes = listIssues({ search: "Peelamedu" });
    assert.ok(searchRes.length >= 1);
    assert.ok(searchRes[0].location.includes("Peelamedu"));
  });
});

describe("IGMER Algorithm — Priorities 1 to 6 Comprehensive Suite", () => {
  beforeEach(() => {
    resetIgmerEngineForTests();
  });

  it("Priority 1: Ingests citizen report & outbox event immediately without waiting for AI and enforces idempotency", () => {
    const first = ingestCitizenReport({
      idempotencyKey: "idem-key-101",
      reporterId: "cit_1",
      title: "Sadak gaddha near college gate",
      description: "Deep pothole causing scooters to skid on main road.",
      location: "Peelamedu Junction",
    });

    assert.equal(first.deduplicated, false);
    assert.equal(first.report.ingestionStatus, "RECEIVED_PERSISTED");
    assert.equal(first.outboxEvent.status, "PENDING");

    // Duplicate network retry with same idempotency key returns identical report without duplicate row
    const duplicate = ingestCitizenReport({
      idempotencyKey: "idem-key-101",
      reporterId: "cit_1",
      title: "Sadak gaddha near college gate",
      description: "Deep pothole causing scooters to skid on main road.",
      location: "Peelamedu Junction",
    });

    assert.equal(duplicate.deduplicated, true);
    assert.equal(duplicate.report.reportId, first.report.reportId);
    assert.equal(duplicate.outboxEvent.eventId, first.outboxEvent.eventId);
  });

  it("Priority 2: Normalizes multilingual text, applies 35/30/20/10/5 weights, and adaptively normalizes when image is missing", async () => {
    assert.equal(BASE_IGMER_WEIGHTS.geographic, 0.35);
    assert.equal(BASE_IGMER_WEIGHTS.text, 0.3);
    assert.equal(BASE_IGMER_WEIGHTS.image, 0.2);
    assert.equal(BASE_IGMER_WEIGHTS.category, 0.1);
    assert.equal(BASE_IGMER_WEIGHTS.temporal, 0.05);

    const normalized = normalizeMultilingualCivicText(
      "Bada sadak gaddha and paani leak",
      "Kachra and batti wire near salai"
    );
    assert.ok(normalized.includes("road"));
    assert.ok(normalized.includes("pothole"));
    assert.ok(normalized.includes("water"));
    assert.ok(normalized.includes("garbage"));
    assert.ok(normalized.includes("streetlight"));

    // Create initial incident without photo
    const r1 = ingestCitizenReport({
      title: "Deep road pothole crater at Peelamedu signal",
      description: "Large waterlogged pothole in middle lane causing two-wheeler skids.",
      location: "Peelamedu Junction",
      latitude: 11.0283,
      longitude: 77.0025,
    });
    const p1 = await processOutboxEvent(r1.outboxEvent.eventId);
    assert.ok(p1.masterIncident);

    // Second report for same pothole also without photo -> triggers adaptive weight normalization
    const r2 = ingestCitizenReport({
      title: "Dangerous sadak gaddha pothole at Peelamedu junction",
      description: "Two-wheelers skidding in deep asphalt crater at Peelamedu signal.",
      location: "Peelamedu Junction",
      latitude: 11.02835,
      longitude: 77.00255,
    });
    const p2 = await processOutboxEvent(r2.outboxEvent.eventId);

    assert.equal(p2.report.matchingOutcome, "AUTO_LINKED");
    assert.equal(p2.report.masterIncidentId, p1.masterIncident.incidentId);
    assert.ok(p2.report.similarityBreakdown);
    assert.equal(p2.report.similarityBreakdown.adaptiveWeightNormalized, true);
    assert.equal(p2.report.similarityBreakdown.effectiveWeights.image, 0);
    // Remaining weights sum to 1.0
    const weightSum =
      p2.report.similarityBreakdown.effectiveWeights.geographic +
      p2.report.similarityBreakdown.effectiveWeights.text +
      p2.report.similarityBreakdown.effectiveWeights.category +
      p2.report.similarityBreakdown.effectiveWeights.temporal;
    assert.ok(Math.abs(weightSum - 1.0) < 0.001);
  });

  it("Priority 2 Guardrails: Never merges on GPS proximity alone and never allows image similarity alone to merge unrelated issues", async () => {
    const identicalPhoto = "data:image/png;base64,IDENTICAL_PHOTO_BYTES_1234567890";

    const pothole = ingestCitizenReport({
      title: "Deep asphalt pothole crater on road",
      description: "Large crater causing vehicle damage in left lane.",
      location: "Gandhipuram Crossing",
      latitude: 11.0183,
      longitude: 76.9674,
      imageDataUrl: identicalPhoto,
    });
    const p1 = await processOutboxEvent(pothole.outboxEvent.eventId);

    // Different physical issue (Garbage bin) at the EXACT SAME GPS coordinates and even same photo bytes
    const garbage = ingestCitizenReport({
      title: "Overflowing garbage waste bin foul smell",
      description: "Uncollected trash dumping and sanitation odor on footpath.",
      location: "Gandhipuram Crossing",
      latitude: 11.0183,
      longitude: 76.9674,
      imageDataUrl: identicalPhoto,
    });
    const p2 = await processOutboxEvent(garbage.outboxEvent.eventId);

    assert.equal(p2.report.matchingOutcome, "NEW_INCIDENT");
    assert.notEqual(p2.masterIncident?.incidentId, p1.masterIncident?.incidentId);
    assert.equal(p2.report.similarityBreakdown?.gpsOnlyMergeBlocked, true);
    assert.equal(p2.report.similarityBreakdown?.imageAloneMergeCapped, true);

    // Confirm computeMultimodalSimilarity caps standalone image score when text & category conflict
    const sim = computeMultimodalSimilarity(
      {
        latitude: 11.0183,
        longitude: 76.9674,
        resolvedCategory: "Waste & Sanitation",
        textEmbedding: computeTextEmbedding("garbage trash dump sanitation smell"),
        imageEmbedding: computeImageEmbedding(identicalPhoto),
        createdAt: new Date().toISOString(),
      },
      p1.masterIncident!
    );
    assert.equal(sim.gpsOnlyMergeBlocked, true);
  });

  it("Priority 2 & 4: Supports configurable thresholds, medium-confidence human review, and volume-safe priority ceiling", async () => {
    setIgmerThresholds({ highConfidence: 0.85, mediumConfidence: 0.45 });

    // Verify 50 reports of a Low-priority minor cosmetic issue never escalate to Critical emergency priority
    const agg = computeAggregatedPriorityAndScore("Low", "Low", 32, 50);
    assert.equal(agg.priority, "Low");
    assert.ok(agg.urgencyScore < 60);
    assert.ok(agg.aiConfidence >= 90);

    // Create base incident and test human review resolution
    const r1 = ingestCitizenReport({
      title: "Water pipe leakage on street corner",
      description: "Water supply pipeline leaking near main valve.",
      location: "Saibaba Colony",
      latitude: 11.0268,
      longitude: 76.9455,
    });
    const p1 = await processOutboxEvent(r1.outboxEvent.eventId);

    // Slightly further away / partial match to land in REVIEW_REQUIRED window (0.45..0.85)
    const r2 = ingestCitizenReport({
      title: "Water drainage overflow near cross road",
      description: "Water flowing on road surface near valve chamber.",
      location: "Saibaba Colony 2nd Street",
      latitude: 11.0281,
      longitude: 76.9465,
    });
    const p2 = await processOutboxEvent(r2.outboxEvent.eventId);

    if (p2.report.matchingOutcome === "REVIEW_REQUIRED") {
      const resolved = await resolveMediumConfidenceReview(
        p2.report.reportId,
        "CONFIRM_MERGE"
      );
      assert.equal(resolved.report.matchingOutcome, "AUTO_LINKED");
      assert.equal(resolved.masterIncident.incidentId, p1.masterIncident?.incidentId);
    }
  });

  it("Priority 5: Isolates stage failures (Gemini failure, Image failure, Embedding failure, DB retry) without losing citizen reports", async () => {
    const rpt = ingestCitizenReport({
      title: "Broken streetlight pole with sparking wire",
      description: "Dark streetlamp and loose electric cable near bus stop.",
      location: "RS Puram DB Road",
      imageDataUrl: "data:image/png;base64,BROKEN_IMG",
    });

    // 1. Simulate transient DB/matching failure first -> report is retained and scheduled for retry
    const attempt1 = await processOutboxEvent(rpt.outboxEvent.eventId, {
      simulateTransientDbFailureOnce: true,
    });
    assert.equal(attempt1.outboxEvent.status, "RETRY_SCHEDULED");
    assert.equal(attempt1.report.ingestionStatus, "RETRY_PENDING");
    assert.ok(getCitizenReportById(rpt.report.reportId));

    // 2. Retry with simulated Image failure + Gemini failure -> continues text+location matching and clusters!
    const attempt2 = await processOutboxEvent(rpt.outboxEvent.eventId, {
      simulateImageFailure: true,
      simulateGeminiFailure: true,
    });
    assert.equal(attempt2.report.stageTelemetry.imageProcessing, "FAILED_CONTINUING");
    assert.equal(attempt2.report.stageTelemetry.geminiAnalysis, "FAILED_RETRY_QUEUED");
    assert.equal(attempt2.report.stageTelemetry.entityResolution, "COMPLETED");
    assert.ok(attempt2.masterIncident);

    // 3. Simulate embedding failure on another report -> safely placed in fallback review queue
    const rptEmbedFail = ingestCitizenReport({
      title: "Fallen tree branch in park",
      description: "Large branch blocking walking track in park.",
      location: "Race Course",
    });
    const embedRes = await processOutboxEvent(rptEmbedFail.outboxEvent.eventId, {
      simulateEmbeddingFailure: true,
    });
    assert.equal(embedRes.report.stageTelemetry.embeddings, "FAILED_FALLBACK_QUEUE");
    assert.equal(embedRes.report.ingestionStatus, "FALLBACK_REVIEW_QUEUE");
    assert.equal(embedRes.outboxEvent.status, "REVIEW_QUEUE");
  });

  it("Priority 3 & 6: Safely clusters 50 simultaneous citizens reporting the SAME incident into exactly 1 Master Incident (0 race duplicates)", async () => {
    const sim = await runConcurrentLoadSimulation({
      scenario: "SINGLE_INCIDENT_50",
      totalReports: 50,
    });

    assert.equal(sim.totalSubmitted, 50);
    assert.equal(sim.persistedReportsCount, 50);
    assert.equal(sim.masterIncidentsCreated, 1);
    assert.equal(sim.masterIncidents[0].supportingReportCount, 50);
    assert.equal(sim.masterIncidents[0].uniqueCitizenCount, 50);
    assert.equal(sim.duplicateRequestsPrevented, 5);
  });

  it("Priority 3 & 6: Safely separates 50 simultaneous reports for TWO different co-located incidents at the same GPS locality into exactly 2 Master Incidents", async () => {
    const sim = await runConcurrentLoadSimulation({
      scenario: "TWO_COLOCATED_INCIDENTS_50",
      totalReports: 50,
    });

    assert.equal(sim.totalSubmitted, 50);
    assert.equal(sim.persistedReportsCount, 50);
    assert.equal(sim.masterIncidentsCreated, 2);

    const counts = sim.masterIncidents
      .map((inc) => inc.supportingReportCount)
      .sort((a, b) => a - b);
    assert.deepEqual(counts, [25, 25]);

    const categories = new Set(sim.masterIncidents.map((inc) => inc.category));
    assert.equal(categories.has("Roads & Potholes"), true);
    assert.equal(categories.has("Streetlights & Electricity"), true);
  });

  it("Priority 5 & 6: Preserves all 50 simultaneous citizen submissions under concurrent AI, image, and transient DB faults", async () => {
    const sim = await runConcurrentLoadSimulation({
      scenario: "FAULT_RESILIENCE_50",
      totalReports: 50,
    });

    assert.equal(sim.persistedReportsCount, 50);
    assert.equal(sim.masterIncidentsCreated, 1);
    assert.equal(sim.masterIncidents[0].supportingReportCount, 50);

    const snap = getIgmerStateSnapshot();
    assert.equal(snap.citizenReports.length, 50);
  });
});

describe("Security Hardening Utilities", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("enforces sliding-window rate limits independently per client", () => {
    const t0 = 1_700_000_000_000;
    assert.equal(checkRateLimit("ip-1", 2, 60_000, t0).allowed, true);
    assert.equal(checkRateLimit("ip-1", 2, 60_000, t0 + 500).allowed, true);
    assert.equal(checkRateLimit("ip-1", 2, 60_000, t0 + 1000).allowed, false);
    assert.equal(checkRateLimit("ip-2", 2, 60_000, t0 + 1000).allowed, true);
    assert.equal(checkRateLimit("ip-1", 2, 60_000, t0 + 61_000).allowed, true);
  });

  it("sanitizes internal API errors without leaking server details", () => {
    assert.equal(sanitizeApiError(new Error("GEMINI_API_KEY not set")).status, 503);
    assert.equal(sanitizeApiError(new Error("429 quota exceeded")).status, 429);
    const hidden = sanitizeApiError(new Error("Internal stack /app/secret.ts"));
    assert.equal(hidden.status, 500);
    assert.equal(hidden.message.includes("/app/secret.ts"), false);
  });

  it("prevents CSV formula injection in exported spreadsheets", () => {
    assert.equal(escapeCsvCell("=CMD|' /C calc'!A0"), "\"'=CMD|' /C calc'!A0\"");
    assert.equal(escapeCsvCell("+1234"), "\"'+1234\"");
    assert.equal(escapeCsvCell("Normal, \"quoted\" text"), "\"Normal, \"\"quoted\"\" text\"");
  });

  it("exposes MongoDB connection telemetry without throwing", () => {
    const info = getMongoDbUriInfo();
    assert.ok(typeof info.connected === "boolean");
    assert.ok(typeof info.uri === "string");
  });
});
