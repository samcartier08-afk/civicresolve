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
  checkRateLimit,
  escapeCsvCell,
  resetRateLimitStore,
  sanitizeApiError,
} from "../src/lib/security.ts";
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
});
