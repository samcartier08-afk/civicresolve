import { NextResponse } from "next/server";
import { classifyCivicIssue } from "@/lib/civic-ai";
import {
  CHENNAI_SYNTHETIC_JURISDICTIONS,
  CreateIssueRequestSchema,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/civic-schemas";
import { ingestCitizenReport, processOutboxEvent } from "@/lib/igmer-engine";
import {
  computeIssueStats,
  createIssue,
  listCitizenNotifications,
  listIssues,
} from "@/lib/issue-store";
import {
  checkRateLimit,
  getClientIdentifier,
  listAuditLogs,
  sanitizeApiError,
  validateImageMagicBytesAndSize,
} from "@/lib/security";

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const rawPriority = searchParams.get("priority");
  const department = searchParams.get("department") ?? undefined;
  const wardCode = searchParams.get("wardCode") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const roleHeader = (req.headers.get("x-civic-role") || "").toLowerCase();
  const includeInternalNotes =
    roleHeader === "authority" ||
    roleHeader === "admin" ||
    searchParams.get("role") === "authority" ||
    searchParams.get("role") === "admin";

  const status =
    rawStatus && (ISSUE_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as IssueStatus)
      : "All";
  const priority =
    rawPriority && (ISSUE_PRIORITIES as readonly string[]).includes(rawPriority)
      ? (rawPriority as IssuePriority)
      : "All";

  const issues = listIssues({
    status,
    priority,
    department,
    wardCode,
    search,
    includeInternalNotes,
  });
  const stats = computeIssueStats();

  return NextResponse.json({
    issues,
    stats,
    notifications: listCitizenNotifications(),
    jurisdictions: CHENNAI_SYNTHETIC_JURISDICTIONS,
    auditLogs: includeInternalNotes ? listAuditLogs() : [],
  });
}

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`create-issue:${getClientIdentifier(req)}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a moment before submitting again." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json();
    const parsed = CreateIssueRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid complaint details." },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      location,
      wardCode,
      latitude,
      longitude,
      locationConsent,
      reporterName,
      isAnonymous,
      userCategory,
      imageBase64,
      imageMimeType,
      imageDataUrl,
      mediaUrls,
      precomputedTriage,
      aiSource,
      aiModel,
    } = parsed.data;

    // Validate magic bytes & 5 MB cap on uploaded images
    if (imageBase64) {
      const check = validateImageMagicBytesAndSize(imageBase64, imageMimeType);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
    }
    if (mediaUrls && mediaUrls.length > 0) {
      for (const dataUrl of mediaUrls) {
        const check = validateImageMagicBytesAndSize(dataUrl);
        if (!check.valid) {
          return NextResponse.json({ error: check.error }, { status: 400 });
        }
      }
    }

    // Priority 1: Ingest-First persistence + Transactional Outbox in same transaction
    const igmerIngested = ingestCitizenReport({
      idempotencyKey: req.headers.get("Idempotency-Key") || undefined,
      reporterName: isAnonymous ? "Anonymous Citizen" : reporterName?.trim() || "Citizen Reporter",
      title,
      description,
      location,
      latitude,
      longitude,
      userCategory: userCategory ?? "Auto",
      imageDataUrl:
        imageDataUrl && imageDataUrl.startsWith("data:image/")
          ? imageDataUrl
          : mediaUrls?.[0],
    });
    const igmerProcessed = await processOutboxEvent(igmerIngested.outboxEvent.eventId);

    let triage = precomputedTriage;
    let resolvedSource = aiSource ?? "gemini";
    let resolvedModel = aiModel ?? "gemini-3.8-flash";

    if (!triage) {
      const aiResult = await classifyCivicIssue({
        title,
        description,
        location,
        userCategory: userCategory ?? "Auto",
        imageBase64,
        imageMimeType,
      });
      triage = aiResult.triage;
      resolvedSource = aiResult.aiSource;
      resolvedModel = aiResult.aiModel;
    }

    const issue = createIssue({
      title,
      description,
      location,
      wardCode,
      latitude,
      longitude,
      locationConsent: locationConsent ?? true,
      reporterName: reporterName?.trim() || "Citizen Reporter",
      isAnonymous: Boolean(isAnonymous),
      userCategory: userCategory ?? "Auto",
      category: triage.category,
      priority: triage.priority,
      urgencyScore: triage.urgencyScore,
      recommendedDepartment: triage.recommendedDepartment,
      publicImpactReason: triage.publicImpactReason,
      citizenSummary: triage.citizenSummary,
      estimatedResolutionWindow: triage.estimatedResolutionWindow,
      recommendedActions: triage.recommendedActions,
      safetyAdvisory: triage.safetyAdvisory,
      confidence: triage.confidence,
      aiSource: resolvedSource,
      aiModel: resolvedModel,
      imageDataUrl:
        imageDataUrl && imageDataUrl.startsWith("data:image/")
          ? imageDataUrl
          : mediaUrls?.[0],
      mediaUrls,
      supportingReportCount:
        igmerProcessed.masterIncident?.supportingReportCount ?? 1,
      isSynthetic: false,
    });

    const stats = computeIssueStats();

    return NextResponse.json(
      {
        issue,
        stats,
        igmer: {
          reportId: igmerProcessed.report.reportId,
          outboxEventId: igmerProcessed.outboxEvent.eventId,
          masterIncidentId: igmerProcessed.masterIncident?.incidentId ?? null,
          matchingOutcome: igmerProcessed.report.matchingOutcome,
          matchingScore: igmerProcessed.report.matchingScore,
          similarityBreakdown: igmerProcessed.report.similarityBreakdown,
          supportingReportCount:
            igmerProcessed.masterIncident?.supportingReportCount ?? 1,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/issues] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
