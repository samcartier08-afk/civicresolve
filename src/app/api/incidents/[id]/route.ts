import { NextResponse } from "next/server";
import type { MunicipalDepartment } from "@/lib/civic-schemas";
import type { PriorityKey, StatusKey } from "@/components/ui/StatusPill";
import { getIssueById, isValidIssueId, updateIssue } from "@/lib/issue-store";
import {
  extractRequestActor,
  fromSitePriority,
  fromSiteStatus,
  issueToIncidentDetail,
  syncMyReportStatus,
  toSiteStatus,
} from "@/lib/portal-store";
import { sanitizeApiError } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const { id } = await context.params;
  if (!isValidIssueId(id)) {
    return NextResponse.json({ error: "Invalid incident ID." }, { status: 400 });
  }
  const found = getIssueById(id, true);
  if (!found) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }
  return NextResponse.json(issueToIncidentDetail(found));
}

export async function PATCH(req: Request, context: Context) {
  try {
    const actor = extractRequestActor(req);
    if (actor.role !== "authority" && actor.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: authority or admin role required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!isValidIssueId(id)) {
      return NextResponse.json({ error: "Invalid incident ID." }, { status: 400 });
    }

    const body = (await req.json()) as {
      status?: StatusKey;
      priority?: PriorityKey;
      department?: MunicipalDepartment;
      publicComment?: string;
      resolutionPhotoUrl?: string;
    };

    const updated = updateIssue(id, {
      status: body.status ? fromSiteStatus(body.status) : undefined,
      priority: body.priority ? fromSitePriority(body.priority) : undefined,
      recommendedDepartment: body.department,
      adminNote: body.publicComment,
      resolutionEvidenceUrl: body.resolutionPhotoUrl,
    });

    if (!updated) {
      return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    }

    syncMyReportStatus(id, toSiteStatus(updated.status));
    return NextResponse.json(issueToIncidentDetail(updated));
  } catch (err) {
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
