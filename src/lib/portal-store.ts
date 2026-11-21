import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CivicIssue, IssuePriority, IssueStatus, MunicipalDepartment } from "./civic-schemas.ts";
import type { PriorityKey, StatusKey } from "../components/ui/StatusPill.tsx";
import type { IncidentRow } from "../components/authority/IncidentQueue.tsx";
import type { NearbyRow, ReportRow } from "./reports.ts";
import { verifyStaffToken } from "./staff-auth.ts";

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
// Persisted to /tmp + globalThis so separate Next.js route bundles share state cleanly.
const MY_REPORTS_FILE = path.join(os.tmpdir(), "civicresolve-my-reports-v1.json");
const globalStore = globalThis as unknown as {
  __civicUserReports?: Map<string, ReportRow[]>;
  __civicIdempotency?: Map<string, { trackingId: string }>;
};

const userReportsMap =
  globalStore.__civicUserReports ?? new Map<string, ReportRow[]>();
globalStore.__civicUserReports = userReportsMap;

const idempotencyReceipts =
  globalStore.__civicIdempotency ?? new Map<string, { trackingId: string }>();
globalStore.__civicIdempotency = idempotencyReceipts;

function loadUserReportsFromDisk(): void {
  try {
    if (!fs.existsSync(MY_REPORTS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(MY_REPORTS_FILE, "utf-8")) as Record<
      string,
      ReportRow[]
    >;
    for (const [uid, list] of Object.entries(raw)) {
      if (Array.isArray(list)) {
        userReportsMap.set(uid, list);
      }
    }
  } catch {
    // Non-fatal
  }
}

function saveUserReportsToDisk(): void {
  try {
    const obj: Record<string, ReportRow[]> = {};
    for (const [uid, list] of userReportsMap.entries()) {
      obj[uid] = list;
    }
    fs.writeFileSync(MY_REPORTS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // Non-fatal
  }
}

export function getMyReportsForUid(uid: string): ReportRow[] {
  loadUserReportsFromDisk();
  return [...(userReportsMap.get(uid) ?? [])];
}

export function addMyReportForUid(uid: string, row: ReportRow): void {
  loadUserReportsFromDisk();
  const existing = userReportsMap.get(uid) ?? [];
  if (!existing.some((r) => r.trackingId === row.trackingId)) {
    existing.unshift(row);
    userReportsMap.set(uid, existing);
    saveUserReportsToDisk();
  }
}

export function syncMyReportStatus(incidentId: string, newStatus: StatusKey): void {
  loadUserReportsFromDisk();
  let changed = false;
  for (const [, list] of userReportsMap.entries()) {
    for (const item of list) {
      if (item.incidentNumber === incidentId || item.trackingId === incidentId) {
        item.status = newStatus;
        changed = true;
      }
    }
  }
  if (changed) saveUserReportsToDisk();
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
  // 1. Check signed Staff Portal token first (for Department / Admin portal sessions)
  const staffToken = req.headers.get("x-staff-token")?.trim();
  const verifiedStaff = verifyStaffToken(staffToken);
  if (verifiedStaff) {
    return {
      uid: verifiedStaff.uid,
      role: verifiedStaff.role,
      name: verifiedStaff.name,
    };
  }

  // 2. Check Firebase Bearer ID token for authenticated users
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        ) as Record<string, unknown>;
        const uid = String(payload.user_id || payload.sub || "citizen-default");
        const email = typeof payload.email === "string" ? payload.email : "";
        const name =
          typeof payload.name === "string"
            ? payload.name
            : email
              ? email.split("@")[0]
              : "Citizen";
        const claimRole = String(payload.role || "citizen");
        const role =
          claimRole === "admin" || claimRole === "authority" ? claimRole : "citizen";
        return { uid, role, name };
      } catch {
        // Fall through
      }
    }
  }

  const uidHeader = req.headers.get("x-demo-uid")?.trim();
  const nameHeader = req.headers.get("x-demo-name")?.trim();

  return {
    uid: uidHeader || "local-citizen",
    role: "citizen",
    name: nameHeader || "Citizen",
  };
}

export function requireActorRole(
  req: Request,
  allowedRoles: Array<RequestActor["role"]>
): { ok: true; actor: RequestActor } | { ok: false; status: 401 | 403; error: string } {
  const actor = extractRequestActor(req);
  const hasAuthCredential = Boolean(
    req.headers.get("x-staff-token")?.trim() ||
      req.headers.get("authorization")?.startsWith("Bearer ")
  );

  if (!hasAuthCredential && allowedRoles.every((r) => r !== "citizen")) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required for staff or admin operations.",
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden: requires role in [${allowedRoles.join(", ")}].`,
    };
  }

  return { ok: true, actor };
}

export type { MunicipalDepartment };
