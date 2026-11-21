import type { CivicIssue, IssuePriority, IssueStatus, MunicipalDepartment } from "./civic-schemas";
import type { PriorityKey, StatusKey } from "@/components/ui/StatusPill";
import type { IncidentRow } from "@/components/authority/IncidentQueue";
import type { NearbyRow, ReportRow } from "./reports";

export interface IncidentDetailRow extends IncidentRow {
  description: string;
  location: string;
  resolutionNote?: string;
  resolutionPhotoUrl?: string;
}

export function toSiteStatus(status: string): StatusKey {
  const map: Record<string, StatusKey> = {
    Reported: "reported",
    "AI Analyzed": "ai_analyzed",
    "Matched/Created": "ai_analyzed",
    "Under Review": "under_review",
    "Awaiting Info": "awaiting_info",
    Assigned: "assigned",
    Accepted: "accepted",
    "In Progress": "in_progress",
    Escalated: "escalated",
    Reopened: "reopened",
    Rejected: "rejected",
    Resolved: "resolved",
    "Citizen Verified": "closed",
    Closed: "closed",
    needs_manual_review: "under_review",
  };
  return map[status] ?? "reported";
}

export function fromSiteStatus(status: StatusKey): IssueStatus {
  const map: Record<StatusKey, IssueStatus> = {
    reported: "Reported",
    ai_analyzed: "AI Analyzed",
    under_review: "Under Review",
    awaiting_info: "Awaiting Info",
    assigned: "Assigned",
    accepted: "Accepted",
    in_progress: "In Progress",
    escalated: "Escalated",
    reopened: "Reopened",
    rejected: "Rejected",
    resolved: "Resolved",
    closed: "Closed",
  };
  return map[status] ?? "Reported";
}

export function toSitePriority(priority: string): PriorityKey {
  const lower = priority.toLowerCase();
  if (lower === "critical" || lower === "high" || lower === "medium" || lower === "low") {
    return lower;
  }
  return "medium";
}

export function fromSitePriority(priority: PriorityKey): IssuePriority {
  const map: Record<PriorityKey, IssuePriority> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return map[priority] ?? "Medium";
}

export function issueToIncidentDetail(issue: CivicIssue): IncidentDetailRow {
  const latestNote = issue.timeline[issue.timeline.length - 1]?.note;
  return {
    id: issue.id,
    number: issue.id,
    title: issue.title,
    status: toSiteStatus(issue.status),
    priority: toSitePriority(issue.priority),
    department: issue.recommendedDepartment,
    reportCount: issue.supportingReportCount ?? 1,
    ageHours: Math.max(
      1,
      Math.round((Date.now() - new Date(issue.createdAt).getTime()) / 3_600_000)
    ),
    ward: issue.wardCode,
    description: issue.description,
    location: issue.location,
    resolutionNote: latestNote,
    resolutionPhotoUrl: issue.resolutionEvidenceUrl,
  };
}

export function issueToNearbyRow(issue: CivicIssue, distanceM: number): NearbyRow {
  return {
    id: issue.id,
    number: issue.id,
    title: issue.title,
    status: toSiteStatus(issue.status),
    priority: toSitePriority(issue.priority),
    reportCount: issue.supportingReportCount ?? 1,
    distanceM: Math.round(distanceM),
  };
}

// Per-user reports store (strictly empty for new users — NO demo/placeholder data!)
const userReportsMap = new Map<string, ReportRow[]>();
const idempotencyReceipts = new Map<string, { trackingId: string }>();

export function getMyReportsForUid(uid: string): ReportRow[] {
  return [...(userReportsMap.get(uid) ?? [])];
}

export function addMyReportForUid(uid: string, row: ReportRow): void {
  const existing = userReportsMap.get(uid) ?? [];
  existing.unshift(row);
  userReportsMap.set(uid, existing);
}

export function syncMyReportStatus(incidentId: string, newStatus: StatusKey): void {
  for (const [, list] of userReportsMap.entries()) {
    for (const item of list) {
      if (item.incidentNumber === incidentId || item.trackingId === incidentId) {
        item.status = newStatus;
      }
    }
  }
}

export function getIdempotentReceipt(key: string): { trackingId: string } | undefined {
  return idempotencyReceipts.get(key);
}

export function saveIdempotentReceipt(key: string, trackingId: string): void {
  idempotencyReceipts.set(key, { trackingId });
}

export interface RequestActor {
  uid: string;
  role: "citizen" | "authority" | "admin";
  name: string;
}

export function extractRequestActor(req: Request): RequestActor {
  const roleHeader = (req.headers.get("x-demo-role") || "").toLowerCase();
  const uidHeader = req.headers.get("x-demo-uid")?.trim();
  const nameHeader = req.headers.get("x-demo-name")?.trim();

  // If a real Firebase JWT is sent, decode payload sub/uid/name safely (signature verified in production Cloud Run)
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        ) as Record<string, unknown>;
        const uid = String(payload.user_id || payload.sub || uidHeader || "citizen-default");
        const email = typeof payload.email === "string" ? payload.email : "";
        const name =
          typeof payload.name === "string"
            ? payload.name
            : email
              ? email.split("@")[0]
              : "Citizen";
        const claimRole = String(payload.role || roleHeader || "citizen");
        const role =
          claimRole === "admin" || claimRole === "authority" ? claimRole : "citizen";
        return { uid, role, name };
      } catch {
        // Fall through to demo headers
      }
    }
  }

  const role: RequestActor["role"] =
    roleHeader === "admin" || roleHeader === "authority" ? roleHeader : "citizen";

  return {
    uid: uidHeader || "local-citizen",
    role,
    name:
      nameHeader ||
      (role === "admin"
        ? "Municipal Admin"
        : role === "authority"
          ? "Department Officer"
          : "Citizen"),
  };
}

export type { MunicipalDepartment };
