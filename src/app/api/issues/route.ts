import { NextResponse } from "next/server";
import { classifyCivicIssue } from "@/lib/civic-ai";
import {
  CreateIssueRequestSchema,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/civic-schemas";
import { computeIssueStats, createIssue, listIssues } from "@/lib/issue-store";
import {
  checkRateLimit,
  getClientIdentifier,
  sanitizeApiError,
} from "@/lib/security";

export const maxDuration = 60;

const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const rawPriority = searchParams.get("priority");
  const search = searchParams.get("search") ?? undefined;

  const status =
    rawStatus && (ISSUE_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as IssueStatus)
      : "All";
  const priority =
    rawPriority && (ISSUE_PRIORITIES as readonly string[]).includes(rawPriority)
      ? (rawPriority as IssuePriority)
      : "All";

  const issues = listIssues({ status, priority, search });
  const stats = computeIssueStats();

  return NextResponse.json({ issues, stats });
}

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`create-issue:${getClientIdentifier(req)}`, 15, 60_000);
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
      reporterName,
      userCategory,
      imageBase64,
      imageMimeType,
      imageDataUrl,
      precomputedTriage,
      aiSource,
      aiModel,
    } = parsed.data;

    if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Uploaded image is too large. Please keep images under 6 MB." },
        { status: 413 }
      );
    }

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
      reporterName: reporterName?.trim() || "Anonymous Citizen",
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
          : undefined,
    });

    const stats = computeIssueStats();
    return NextResponse.json({ issue, stats }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/issues] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
