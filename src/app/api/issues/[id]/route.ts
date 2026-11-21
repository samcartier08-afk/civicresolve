import { NextResponse } from "next/server";
import { UpdateIssueRequestSchema } from "@/lib/civic-schemas";
import { extractRequestActor } from "@/lib/portal-store";
import {
  computeIssueStats,
  deleteIssue,
  getIssueById,
  isValidIssueId,
  listCitizenNotifications,
  updateIssue,
} from "@/lib/issue-store";
import {
  checkRateLimit,
  getClientIdentifier,
  listAuditLogs,
  sanitizeApiError,
} from "@/lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isValidIssueId(id)) {
    return NextResponse.json({ error: "Invalid issue tracking ID format." }, { status: 400 });
  }

  const issue = getIssueById(id);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  return NextResponse.json({ issue });
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const rate = checkRateLimit(`update-issue:${getClientIdentifier(req)}`, 40, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many updates. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const { id } = await context.params;
    if (!isValidIssueId(id)) {
      return NextResponse.json({ error: "Invalid issue tracking ID format." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateIssueRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload." },
        { status: 400 }
      );
    }

    const actor = extractRequestActor(req);
    if (!parsed.data.citizenAction && actor.role !== "authority" && actor.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: authority or admin role required." },
        { status: 403 }
      );
    }

    const updated = updateIssue(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }

    return NextResponse.json({
      issue: updated,
      stats: computeIssueStats(),
      notifications: listCitizenNotifications(),
      auditLogs: listAuditLogs(),
    });
  } catch (err) {
    console.error("[PATCH /api/issues/[id]] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const actor = extractRequestActor(req);
  if (actor.role !== "authority" && actor.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: authority or admin role required." },
      { status: 403 }
    );
  }

  const rate = checkRateLimit(`delete-issue:${getClientIdentifier(req)}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await context.params;
  if (!isValidIssueId(id)) {
    return NextResponse.json({ error: "Invalid issue tracking ID format." }, { status: 400 });
  }

  const removed = deleteIssue(id);
  if (!removed) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id, stats: computeIssueStats() });
}
