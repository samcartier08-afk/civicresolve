import { NextResponse } from "next/server";
import { classifyCivicIssue } from "@/lib/civic-ai";
import { ingestCitizenReport, processOutboxEvent } from "@/lib/igmer-engine";
import { createIssue } from "@/lib/issue-store";
import {
  addMyReportForUid,
  extractRequestActor,
  getIdempotentReceipt,
  saveIdempotentReceipt,
  toSiteStatus,
} from "@/lib/portal-store";
import {
  checkRateLimit,
  getClientIdentifier,
  sanitizeApiError,
  validateImageMagicBytesAndSize,
} from "@/lib/security";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`site-report:${getClientIdentifier(req)}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (idempotencyKey) {
      const existing = getIdempotentReceipt(idempotencyKey);
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    const actor = extractRequestActor(req);
    const formData = await req.formData();

    const description = String(formData.get("description") || "").trim();
    const landmark = String(formData.get("landmark") || "").trim();
    const latRaw = formData.get("lat");
    const lngRaw = formData.get("lng");
    const anonymous = String(formData.get("anonymous") || "false") === "true";

    if (description.length < 10) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters." },
        { status: 400 }
      );
    }

    const latitude = latRaw !== null && latRaw !== "" ? Number(latRaw) : undefined;
    const longitude = lngRaw !== null && lngRaw !== "" ? Number(lngRaw) : undefined;

    const location =
      landmark.length > 2
        ? landmark
        : latitude !== undefined && longitude !== undefined
          ? `GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
          : "Reported Neighborhood Location";

    // Parse & validate up to 4 uploaded images (JPEG/PNG/WebP magic bytes + 5 MB cap)
    const files = formData.getAll("images").slice(0, 4);
    const mediaUrls: string[] = [];
    let firstBase64: string | undefined;
    let firstMime: string | undefined;

    for (const item of files) {
      if (item && typeof item === "object" && "arrayBuffer" in item) {
        const file = item as File;
        const buf = Buffer.from(await file.arrayBuffer());
        const base64 = buf.toString("base64");
        const check = validateImageMagicBytesAndSize(base64, file.type);
        if (!check.valid) {
          return NextResponse.json({ error: check.error }, { status: 400 });
        }
        const mime = check.detectedMime || file.type || "image/jpeg";
        const dataUrl = `data:${mime};base64,${base64}`;
        mediaUrls.push(dataUrl);
        if (!firstBase64) {
          firstBase64 = base64;
          firstMime = mime;
        }
      }
    }

    const title = description.slice(0, 90).trim();

    // Priority 1: Ingest-First + Transactional Outbox + IGMER Entity Resolution
    const igmerIngested = ingestCitizenReport({
      idempotencyKey: idempotencyKey || undefined,
      reporterId: actor.uid,
      reporterName: anonymous ? "Anonymous Citizen" : actor.name,
      title,
      description,
      location,
      latitude,
      longitude,
      imageDataUrl: mediaUrls[0],
    });
    const igmerProcessed = await processOutboxEvent(igmerIngested.outboxEvent.eventId);

    // Run Gemini AI triage (gracefully falls back if key is unset)
    const aiResult = await classifyCivicIssue({
      title,
      description,
      location,
      userCategory: "Auto",
      imageBase64: firstBase64,
      imageMimeType: firstMime,
    });

    const created = createIssue({
      title,
      description,
      location,
      latitude,
      longitude,
      locationConsent: true,
      reporterName: anonymous ? "Anonymous Citizen" : actor.name,
      isAnonymous: anonymous,
      userCategory: "Auto",
      category: aiResult.triage.category,
      priority: aiResult.triage.priority,
      urgencyScore: aiResult.triage.urgencyScore,
      recommendedDepartment: aiResult.triage.recommendedDepartment,
      publicImpactReason: aiResult.triage.publicImpactReason,
      citizenSummary: aiResult.triage.citizenSummary,
      estimatedResolutionWindow: aiResult.triage.estimatedResolutionWindow,
      recommendedActions: aiResult.triage.recommendedActions,
      safetyAdvisory: aiResult.triage.safetyAdvisory,
      confidence: aiResult.triage.confidence,
      aiSource: aiResult.aiSource,
      aiModel: aiResult.aiModel,
      imageDataUrl: mediaUrls[0],
      mediaUrls,
      supportingReportCount:
        igmerProcessed.masterIncident?.supportingReportCount ?? 1,
      isSynthetic: false,
    });

    const reportRow = {
      id: igmerProcessed.report.reportId,
      trackingId: created.id,
      description: created.description,
      status: toSiteStatus(created.status),
      createdAt: created.createdAt,
      incidentNumber: created.id,
    };

    // Store in this user's own My Reports list (unless anonymous)
    if (!anonymous) {
      addMyReportForUid(actor.uid, reportRow);
    }

    if (idempotencyKey) {
      saveIdempotentReceipt(idempotencyKey, created.id);
    }

    return NextResponse.json(
      { trackingId: created.id, report: anonymous ? null : reportRow },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/reports] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
