import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CitizenNotification,
  CivicIssue,
  IssuePriority,
  IssueStats,
  IssueStatus,
  MunicipalDepartment,
} from "./civic-schemas.ts";
import { normalizeCoordinates } from "./igmer-engine.ts";
import { recordAuditLog } from "./security.ts";

const STORE_FILE_PATH = path.join(os.tmpdir(), "civicresolve-issues-v2.json");
const ISSUE_ID_PATTERN = /^CR-\d{4}-\d{4,5}$/;

const RESOLVED_STATES: readonly IssueStatus[] = [
  "Resolved",
  "Citizen Verified",
  "Closed",
];

const IN_PROGRESS_STATES: readonly IssueStatus[] = [
  "Under Review",
  "Assigned",
  "Accepted",
  "In Progress",
  "Escalated",
  "Reopened",
  "Awaiting Info",
];

function createSeedIssues(): CivicIssue[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

  return [
    {
      id: "CR-2026-1001",
      title: "Burst drinking water pipeline flooding Peelamedu & Anna Nagar link road",
      description:
        "An underground municipal water pipe ruptured near the bus stop. Heavy water flow is flooding two lanes and wasting thousands of liters per hour.",
      location: "Anna Nagar 2nd Avenue / Peelamedu Junction, Ward 101, Chennai",
      wardCode: "GCC-W101",
      latitude: 13.085,
      longitude: 80.2101,
      locationConsent: true,
      reporterName: "Ananya R.",
      isAnonymous: false,
      userCategory: "Auto",
      category: "Water & Drainage",
      priority: "Critical",
      urgencyScore: 95,
      recommendedDepartment: "Water Supply & Sewerage Board",
      publicImpactReason:
        "Active potable water loss combined with severe arterial road flooding creates immediate hydroplaning and traffic hazard.",
      citizenSummary:
        "Critical main water pipeline rupture flooding arterial junction.",
      estimatedResolutionWindow: "4-6 hours (Emergency)",
      recommendedActions: [
        "Shut off upstream isolation valve immediately.",
        "Dispatch emergency pipeline repair and dewatering crew.",
        "Coordinate with traffic police to cone off flooded lanes.",
      ],
      safetyAdvisory:
        "Avoid driving through standing water at the junction; expect temporary low water pressure nearby.",
      confidence: 97,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "In Progress",
      mediaUrls: [],
      supportingReportCount: 4,
      isSynthetic: true,
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(2),
      timeline: [
        {
          timestamp: hoursAgo(5),
          status: "Reported",
          actor: "Citizen",
          note: "Submitted complaint with GPS coordinates and location consent.",
        },
        {
          timestamp: hoursAgo(5),
          prevStatus: "Reported",
          status: "Matched/Created",
          actor: "Gemini AI",
          note: "Classified as Critical Water & Drainage issue (95/100) and clustered 4 citizen reports.",
          internalNote: "AI confidence 0.97; pgvector cosine 0.91 across 4 nearby reports.",
        },
        {
          timestamp: hoursAgo(2),
          prevStatus: "Matched/Created",
          status: "In Progress",
          actor: "Authority Officer",
          note: "Emergency valve team #3 dispatched on site; dewatering pump active.",
          internalNote: "Internal work order #CMWSSB-8821 assigned to Asst. Engineer Ramesh.",
        },
      ],
    },
    {
      id: "CR-2026-1002",
      title: "Deep waterlogged pothole right outside school pedestrian gate",
      description:
        "A 3-foot wide pothole formed after rain right in front of the school pedestrian crossing. Two-wheelers are skidding during morning drop-off hours.",
      location: "Pondy Bazaar Main Road, Near Govt High School, Ward 136, Chennai",
      wardCode: "GCC-W136",
      latitude: 13.0418,
      longitude: 80.2341,
      locationConsent: true,
      reporterName: "Karthik M.",
      isAnonymous: false,
      userCategory: "Roads & Potholes",
      category: "Roads & Potholes",
      priority: "High",
      urgencyScore: 86,
      recommendedDepartment: "Public Works & Roads Department (PWD)",
      publicImpactReason:
        "Located directly outside a school pedestrian zone where hidden waterlogged road craters pose high two-wheeler and student safety risk.",
      citizenSummary:
        "High-risk deep pothole causing two-wheeler skids outside school gate.",
      estimatedResolutionWindow: "24 hours",
      recommendedActions: [
        "Place reflective safety cones around the crater immediately.",
        "Drain accumulated rainwater and apply cold-mix/hot-mix asphalt patch.",
        "Inspect adjacent 100m road stretch for surface fatigue.",
      ],
      safetyAdvisory:
        "Slow down below 20 km/h near the school gate, especially during rain.",
      confidence: 96,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "Reported",
      mediaUrls: [],
      supportingReportCount: 2,
      isSynthetic: true,
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(9),
      timeline: [
        {
          timestamp: hoursAgo(9),
          status: "Reported",
          actor: "Citizen",
          note: "Complaint submitted for deep pothole near school crossing.",
        },
        {
          timestamp: hoursAgo(9),
          prevStatus: "Reported",
          status: "AI Analyzed",
          actor: "Gemini AI",
          note: "Detected High urgency (86/100) due to school zone proximity; recommended PWD.",
        },
      ],
    },
    {
      id: "CR-2026-1003",
      title: "Exposed sparking streetlight wire hanging near bus shelter",
      description:
        "Six consecutive LED streetlamps are dark and one damaged pole has an exposed low-hanging cable sparking intermittently near waiting commuters.",
      location: "Mylapore Luz Corner Bus Shelter, Ward 126, Chennai",
      wardCode: "GCC-W126",
      latitude: 13.0339,
      longitude: 80.2676,
      locationConsent: true,
      reporterName: "Anonymous Citizen",
      isAnonymous: true,
      anonymousTrackingToken: "VERIFY-CR1003-9A2F",
      userCategory: "Auto",
      category: "Streetlights & Electricity",
      priority: "Critical",
      urgencyScore: 98,
      recommendedDepartment: "Electricity & Streetlighting Board",
      publicImpactReason:
        "Single exposed live wire in a high-footfall bus shelter presents immediate electrocution hazard.",
      citizenSummary:
        "Critical exposed live streetlight wire at Mylapore Luz Corner bus shelter.",
      estimatedResolutionWindow: "2-4 hours (Immediate Safety Hazard)",
      recommendedActions: [
        "Isolate feeder pillar circuit breaker immediately.",
        "Barricade 10m perimeter around the leaning pole.",
        "Replace damaged insulation and restore streetlamp circuit.",
      ],
      safetyAdvisory:
        "Stay at least 10 meters away from the affected pole and do not touch wet metal railings nearby.",
      confidence: 99,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "Assigned",
      mediaUrls: [],
      supportingReportCount: 1,
      isSynthetic: true,
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(11),
      timeline: [
        {
          timestamp: hoursAgo(14),
          status: "Reported",
          actor: "Citizen",
          note: "Anonymous report submitted for exposed wire and dark streetlights.",
        },
        {
          timestamp: hoursAgo(14),
          prevStatus: "Reported",
          status: "AI Analyzed",
          actor: "Gemini AI",
          note: "Single exposed live wire elevated immediately to Critical (98/100) -> Electricity Board.",
        },
        {
          timestamp: hoursAgo(11),
          prevStatus: "AI Analyzed",
          status: "Assigned",
          actor: "Authority Officer",
          note: "Assigned emergency TANGEDCO line safety squad.",
        },
      ],
    },
    {
      id: "CR-2026-1004",
      title: "Overflowing community garbage compactor bin blocking footpath",
      description:
        "The municipal compactor bin behind the vegetable market has not been cleared in 3 days. Organic waste is spilling onto the footpath with strong odor.",
      location: "Adyar Besant Avenue Market Lane, Ward 173, Chennai",
      wardCode: "GCC-W173",
      latitude: 13.0012,
      longitude: 80.2565,
      locationConsent: true,
      reporterName: "Suresh K.",
      isAnonymous: false,
      userCategory: "Waste & Sanitation",
      category: "Waste & Sanitation",
      priority: "Medium",
      urgencyScore: 67,
      recommendedDepartment: "Municipal Solid Waste & Sanitation",
      publicImpactReason:
        "Accumulating organic market waste blocks pedestrian access and creates localized hygiene concerns.",
      citizenSummary:
        "Overflowing market garbage bin blocking footpath at Adyar Market Lane.",
      estimatedResolutionWindow: "12-24 hours",
      recommendedActions: [
        "Schedule priority compactor truck clearance on morning route.",
        "Sanitize surrounding footpath with disinfectant spray.",
      ],
      safetyAdvisory:
        "Use the opposite footpath near the market lane until sanitation clearance is completed.",
      confidence: 95,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "In Progress",
      mediaUrls: [],
      supportingReportCount: 3,
      isSynthetic: true,
      createdAt: hoursAgo(22),
      updatedAt: hoursAgo(6),
      timeline: [
        {
          timestamp: hoursAgo(22),
          status: "Reported",
          actor: "Citizen",
          note: "Reported overflowing bin behind vegetable market.",
        },
        {
          timestamp: hoursAgo(6),
          prevStatus: "Reported",
          status: "In Progress",
          actor: "Municipal Admin",
          note: "Sanitation vehicle TN-01-G-4412 assigned for clearance and bleaching.",
        },
      ],
    },
    {
      id: "CR-2026-1005",
      title: "Stormwater grate clogged with leaves and plastic debris",
      description:
        "Roadside stormwater drain near the park entrance is completely choked, causing ankle-deep waterlogging even during light drizzle.",
      location: "OMR Sholinganallur Park South Gate, Ward 192, Chennai",
      wardCode: "GCC-W192",
      latitude: 12.901,
      longitude: 80.2279,
      locationConsent: true,
      reporterName: "Deepak V.",
      isAnonymous: false,
      userCategory: "Water & Drainage",
      category: "Water & Drainage",
      priority: "Low",
      urgencyScore: 44,
      recommendedDepartment: "Water Supply & Sewerage Board",
      publicImpactReason:
        "Localized minor waterlogging during rainfall; quick preventive desilting avoids mosquito breeding.",
      citizenSummary:
        "Clogged stormwater grate causing minor waterlogging at Park South Gate.",
      estimatedResolutionWindow: "2-3 days",
      recommendedActions: [
        "Remove plastic/leaf blockage and flush stormwater silt trap.",
        "Verify grate alignment after cleaning.",
      ],
      safetyAdvisory: "No immediate safety hazard reported.",
      confidence: 92,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "Resolved",
      mediaUrls: [],
      supportingReportCount: 1,
      isSynthetic: true,
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(10),
      timeline: [
        {
          timestamp: hoursAgo(48),
          status: "Reported",
          actor: "Citizen",
          note: "Reported clogged stormwater drain near Park South Gate.",
        },
        {
          timestamp: hoursAgo(26),
          prevStatus: "Reported",
          status: "In Progress",
          actor: "Municipal Admin",
          note: "Desilting crew scheduled for afternoon maintenance.",
        },
        {
          timestamp: hoursAgo(10),
          prevStatus: "In Progress",
          status: "Resolved",
          actor: "Municipal Admin",
          note: "Drain cleared, silt removed, and flow tested. Ready for citizen verification.",
        },
      ],
    },
  ];
}

let issuesCache: CivicIssue[] | null = null;
let notificationsCache: CitizenNotification[] = [
  {
    id: "NOTIF-2026-01",
    issueId: "CR-2026-1005",
    title: "Resolution Ready for Verification (CR-2026-1005)",
    message:
      "Municipal crews marked 'Stormwater grate clogged with leaves' as Resolved. Please confirm if the issue is fixed or dispute to reopen.",
    createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    read: false,
  },
];
let sequenceCounter = 1005;

function loadStore(): CivicIssue[] {
  if (issuesCache) return issuesCache;

  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as CivicIssue[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        issuesCache = parsed;
        for (const item of parsed) {
          const num = Number(item.id.split("-")[2]);
          if (Number.isFinite(num) && num > sequenceCounter) {
            sequenceCounter = num;
          }
        }
        return issuesCache;
      }
    }
  } catch {
    // Fall back to fresh seeded state
  }

  issuesCache = createSeedIssues();
  persistStore();
  return issuesCache;
}

function persistStore(): void {
  if (!issuesCache) return;
  try {
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(issuesCache, null, 2), "utf-8");
  } catch {
    // Non-fatal in read-only environments
  }
}

export function isValidIssueId(id: string): boolean {
  return ISSUE_ID_PATTERN.test(id);
}

/**
 * Strips internal authority notes from public/citizen responses
 * ("Citizens never see internal notes or AI reasoning").
 */
export function sanitizeIssueForCitizen(issue: CivicIssue): CivicIssue {
  return {
    ...issue,
    timeline: issue.timeline.map(({ internalNote: _hidden, ...publicEvent }) => publicEvent),
  };
}

export function listIssues(
  filters?: {
    status?: IssueStatus | "All";
    priority?: IssuePriority | "All";
    department?: string;
    wardCode?: string;
    search?: string;
    includeInternalNotes?: boolean;
  }
): CivicIssue[] {
  const all = [...loadStore()];
  let filtered = all;

  if (filters?.status && filters.status !== "All") {
    filtered = filtered.filter((i) => i.status === filters.status);
  }
  if (filters?.priority && filters.priority !== "All") {
    filtered = filtered.filter((i) => i.priority === filters.priority);
  }
  if (filters?.department && filters.department !== "All") {
    filtered = filtered.filter((i) => i.recommendedDepartment === filters.department);
  }
  if (filters?.wardCode && filters.wardCode !== "All") {
    filtered = filtered.filter((i) => i.wardCode === filters.wardCode);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.id.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.recommendedDepartment.toLowerCase().includes(q)
    );
  }

  const sorted = filtered.sort((a, b) => {
    const aDone = RESOLVED_STATES.includes(a.status);
    const bDone = RESOLVED_STATES.includes(b.status);
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    return b.urgencyScore - a.urgencyScore;
  });

  return filters?.includeInternalNotes
    ? sorted
    : sorted.map(sanitizeIssueForCitizen);
}

export function getIssueById(id: string, includeInternalNotes = false): CivicIssue | undefined {
  const found = loadStore().find((i) => i.id === id);
  if (!found) return undefined;
  return includeInternalNotes ? found : sanitizeIssueForCitizen(found);
}

export interface CreateIssueInput {
  title: string;
  description: string;
  location: string;
  wardCode?: string;
  latitude?: number;
  longitude?: number;
  locationConsent?: boolean;
  reporterName: string;
  isAnonymous?: boolean;
  userCategory: CivicIssue["userCategory"];
  category: CivicIssue["category"];
  priority: CivicIssue["priority"];
  urgencyScore: number;
  recommendedDepartment: CivicIssue["recommendedDepartment"];
  publicImpactReason: string;
  citizenSummary: string;
  estimatedResolutionWindow: string;
  recommendedActions: string[];
  safetyAdvisory: string;
  confidence: number;
  aiSource: "gemini" | "fallback";
  aiModel: string;
  imageDataUrl?: string;
  mediaUrls?: string[];
  supportingReportCount?: number;
  isSynthetic?: boolean;
}

export function createIssue(data: CreateIssueInput): CivicIssue {
  const store = loadStore();
  sequenceCounter += 1;
  const id = `CR-2026-${String(sequenceCounter).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const coords = normalizeCoordinates(data.location, data.latitude, data.longitude);
  const isAnonymous = Boolean(data.isAnonymous);
  const anonymousTrackingToken = isAnonymous
    ? `VERIFY-${id.replace("CR-2026-", "CR")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    : undefined;

  const mediaUrls =
    data.mediaUrls && data.mediaUrls.length > 0
      ? data.mediaUrls.slice(0, 4)
      : data.imageDataUrl
        ? [data.imageDataUrl]
        : [];

  const issue: CivicIssue = {
    ...data,
    id,
    wardCode: data.wardCode || "GCC-W101",
    latitude: coords.latitude,
    longitude: coords.longitude,
    locationConsent: data.locationConsent ?? true,
    reporterName: isAnonymous ? "Anonymous Citizen" : data.reporterName || "Citizen Reporter",
    isAnonymous,
    anonymousTrackingToken,
    status: "Reported",
    mediaUrls,
    supportingReportCount: data.supportingReportCount ?? 1,
    isSynthetic: Boolean(data.isSynthetic),
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        timestamp: now,
        status: "Reported",
        actor: "Citizen",
        note: `Submitted civic report for ${data.location}.`,
      },
      {
        timestamp: now,
        prevStatus: "Reported",
        status: "Reported",
        actor: "Gemini AI",
        note: `Classified as ${data.priority} ${data.category} (${data.urgencyScore}/100) and routed to ${data.recommendedDepartment}.`,
        internalNote: `AI confidence ${data.confidence}%; model ${data.aiModel}.`,
      },
    ],
  };

  store.unshift(issue);
  persistStore();
  return issue;
}

export function updateIssue(
  id: string,
  updates: {
    status?: IssueStatus;
    priority?: IssuePriority;
    priorityOverrideReason?: string;
    recommendedDepartment?: MunicipalDepartment;
    adminNote?: string;
    internalNote?: string;
    resolutionEvidenceUrl?: string;
    citizenAction?: "VERIFY_RESOLUTION" | "DISPUTE_REOPEN";
    citizenFeedback?: string;
  }
): CivicIssue | null {
  const store = loadStore();
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const existing = store[idx];
  const now = new Date().toISOString();
  let nextStatus = updates.status ?? existing.status;
  let actor: "Citizen" | "Municipal Admin" | "Authority Officer" = "Authority Officer";

  const changeNotes: string[] = [];

  if (updates.citizenAction === "VERIFY_RESOLUTION") {
    nextStatus = "Citizen Verified";
    actor = "Citizen";
    changeNotes.push(
      updates.citizenFeedback?.trim() ||
        "Citizen confirmed that the physical problem has been resolved on site."
    );
  } else if (updates.citizenAction === "DISPUTE_REOPEN") {
    nextStatus = "Reopened";
    actor = "Citizen";
    changeNotes.push(
      updates.citizenFeedback?.trim() ||
        "Citizen disputed the resolution and reopened the incident for further crew work."
    );
  } else {
    if (updates.status && updates.status !== existing.status) {
      changeNotes.push(`Status changed from ${existing.status} to ${updates.status}.`);
    }
    if (updates.priority && updates.priority !== existing.priority) {
      changeNotes.push(
        `Priority overridden from ${existing.priority} to ${updates.priority}${
          updates.priorityOverrideReason ? ` (${updates.priorityOverrideReason})` : ""
        }.`
      );
      recordAuditLog({
        actorUid: "admin_officer",
        actorRole: "admin",
        action: "PRIORITY_OVERRIDE",
        targetId: id,
        details: `Overrode priority ${existing.priority} -> ${updates.priority}. Reason: ${
          updates.priorityOverrideReason || "Administrative review"
        }`,
      });
    }
    if (
      updates.recommendedDepartment &&
      updates.recommendedDepartment !== existing.recommendedDepartment
    ) {
      changeNotes.push(`Reassigned to ${updates.recommendedDepartment}.`);
    }
    if (updates.adminNote && updates.adminNote.trim()) {
      changeNotes.push(updates.adminNote.trim());
    }
  }

  // Trigger citizen notification when authority transitions to Resolved
  if (nextStatus === "Resolved" && existing.status !== "Resolved") {
    notificationsCache.unshift({
      id: `NOTIF-${Date.now()}`,
      issueId: id,
      title: `Resolution Ready for Your Verification (${id})`,
      message: `Authority marked "${existing.title}" as Resolved. Please confirm the fix or dispute to reopen.`,
      createdAt: now,
      read: false,
    });
  }

  const updated: CivicIssue = {
    ...existing,
    status: nextStatus,
    priority: updates.priority ?? existing.priority,
    recommendedDepartment:
      updates.recommendedDepartment ?? existing.recommendedDepartment,
    resolutionEvidenceUrl:
      updates.resolutionEvidenceUrl ?? existing.resolutionEvidenceUrl,
    updatedAt: now,
    timeline: [
      ...existing.timeline,
      {
        timestamp: now,
        prevStatus: existing.status,
        status: nextStatus,
        actor,
        note: changeNotes.join(" ") || "Ticket updated by municipal authority.",
        internalNote: updates.internalNote?.trim() || undefined,
        evidenceUrl: updates.resolutionEvidenceUrl,
      },
    ],
  };

  store[idx] = updated;
  persistStore();
  return updated;
}

export function deleteIssue(id: string): boolean {
  const store = loadStore();
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  store.splice(idx, 1);
  persistStore();
  return true;
}

export function listCitizenNotifications(): CitizenNotification[] {
  return [...notificationsCache];
}

export function computeIssueStats(issues?: CivicIssue[]): IssueStats {
  const list = issues ?? loadStore();
  const total = list.length;
  const resolved = list.filter((i) => RESOLVED_STATES.includes(i.status)).length;
  const citizenVerified = list.filter((i) => i.status === "Citizen Verified").length;
  const inProgress = list.filter((i) => IN_PROGRESS_STATES.includes(i.status)).length;
  const reported = total - resolved - inProgress;
  const criticalAndHigh = list.filter(
    (i) => !RESOLVED_STATES.includes(i.status) && (i.priority === "Critical" || i.priority === "High")
  ).length;

  const byCategory: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const byWard: Record<string, number> = {};

  for (const item of list) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    byDepartment[item.recommendedDepartment] =
      (byDepartment[item.recommendedDepartment] ?? 0) + 1;
    const ward = item.wardCode || "Unassigned";
    byWard[ward] = (byWard[ward] ?? 0) + 1;
  }

  return {
    total,
    reported,
    inProgress,
    resolved,
    citizenVerified,
    criticalAndHigh,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    byCategory,
    byDepartment,
    byWard,
  };
}

export function resetIssueStoreForTests(): void {
  sequenceCounter = 1005;
  issuesCache = createSeedIssues();
}
