import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CivicIssue,
  IssuePriority,
  IssueStats,
  IssueStatus,
  MunicipalDepartment,
} from "./civic-schemas.ts";

const STORE_FILE_PATH = path.join(os.tmpdir(), "civicresolve-issues-v1.json");
const ISSUE_ID_PATTERN = /^CR-\d{4}-\d{4}$/;

function createSeedIssues(): CivicIssue[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

  return [
    {
      id: "CR-2026-1001",
      title: "Burst drinking water pipeline flooding main junction",
      description:
        "An underground municipal water pipe ruptured near Peelamedu Bus Stop. Heavy water flow is flooding two lanes and wasting thousands of liters per hour.",
      location: "Avinashi Road, Peelamedu Junction, Ward 28",
      reporterName: "Ananya R.",
      userCategory: "Auto",
      category: "Water & Drainage",
      priority: "Critical",
      urgencyScore: 95,
      recommendedDepartment: "Water Supply & Sewerage Board",
      publicImpactReason:
        "Active potable water loss combined with severe arterial road flooding creates immediate hydroplaning and traffic hazard.",
      citizenSummary:
        "Critical main water pipeline rupture flooding Avinashi Road at Peelamedu Junction.",
      estimatedResolutionWindow: "4-6 hours (Emergency)",
      recommendedActions: [
        "Shut off Ward 28 upstream isolation valve immediately.",
        "Dispatch emergency pipeline repair and dewatering crew.",
        "Coordinate with traffic police to cone off flooded lanes.",
      ],
      safetyAdvisory:
        "Avoid driving through standing water at Peelamedu Junction; expect temporary low water pressure nearby.",
      confidence: 97,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "In Progress",
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(2),
      timeline: [
        {
          timestamp: hoursAgo(5),
          status: "Reported",
          actor: "Citizen",
          note: "Submitted complaint with location details at Peelamedu Junction.",
        },
        {
          timestamp: hoursAgo(5),
          status: "Reported",
          actor: "Gemini AI",
          note: "Classified as Critical Water & Drainage issue (95/100) and routed to Water Supply & Sewerage Board.",
        },
        {
          timestamp: hoursAgo(2),
          status: "In Progress",
          actor: "Municipal Admin",
          note: "Emergency valve team #3 dispatched on site; dewatering pump active.",
        },
      ],
    },
    {
      id: "CR-2026-1002",
      title: "Deep waterlogged pothole right outside school gate",
      description:
        "A 3-foot wide pothole formed after rain right in front of the school pedestrian crossing. Two-wheelers are skidding during morning drop-off hours.",
      location: "Neelambur Main Road, Near Govt High School, Ward 14",
      reporterName: "Karthik M.",
      userCategory: "Roads & Potholes",
      category: "Roads & Potholes",
      priority: "High",
      urgencyScore: 86,
      recommendedDepartment: "Public Works & Roads Department (PWD)",
      publicImpactReason:
        "Located directly outside a school pedestrian zone where hidden waterlogged road craters pose high two-wheeler and student safety risk.",
      citizenSummary:
        "High-risk deep pothole causing two-wheeler skids outside Neelambur school gate.",
      estimatedResolutionWindow: "24 hours",
      recommendedActions: [
        "Place reflective safety cones around the crater immediately.",
        "Drain accumulated rainwater and apply cold-mix/hot-mix asphalt patch.",
        "Inspect adjacent 100m road stretch for surface fatigue.",
      ],
      safetyAdvisory:
        "Slow down below 20 km/h near Neelambur Govt High School gate, especially during rain.",
      confidence: 96,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "Reported",
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
          status: "Reported",
          actor: "Gemini AI",
          note: "Detected High urgency (86/100) due to school zone proximity; recommended PWD.",
        },
      ],
    },
    {
      id: "CR-2026-1003",
      title: "Row of 6 streetlights non-functional on commuter stretch",
      description:
        "Six consecutive LED streetlamps have been completely dark for 4 nights along the hostel-to-bus-stand stretch, creating poor visibility for pedestrians and cyclists.",
      location: "Saravanampatti IT Park Link Road, Ward 19",
      reporterName: "Priya S.",
      userCategory: "Auto",
      category: "Streetlights & Electricity",
      priority: "High",
      urgencyScore: 81,
      recommendedDepartment: "Electricity & Streetlighting Board",
      publicImpactReason:
        "Extended dark corridor on an active evening commuter and student route elevates pedestrian safety and collision risks.",
      citizenSummary:
        "Six consecutive streetlights out for 4 days along Saravanampatti IT Park Link Road.",
      estimatedResolutionWindow: "24-36 hours",
      recommendedActions: [
        "Inspect feeder pillar box and circuit breaker for Ward 19 stretch.",
        "Test underground cable continuity and replace faulty LED drivers.",
      ],
      safetyAdvisory:
        "Pedestrians and cyclists should use reflective gear or well-lit alternate paths after sunset.",
      confidence: 94,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "Reported",
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(14),
      timeline: [
        {
          timestamp: hoursAgo(14),
          status: "Reported",
          actor: "Citizen",
          note: "Reported 6 non-working streetlamps along commuter road.",
        },
        {
          timestamp: hoursAgo(14),
          status: "Reported",
          actor: "Gemini AI",
          note: "Auto-categorized as Streetlights & Electricity (High, 81/100) -> Electricity & Streetlighting Board.",
        },
      ],
    },
    {
      id: "CR-2026-1004",
      title: "Overflowing community garbage bin attracting stray animals",
      description:
        "The municipal compactor bin behind the vegetable market has not been cleared in 3 days. Organic waste is spilling onto the footpath with strong odor.",
      location: "Gandhipuram 4th Street Market Lane, Ward 32",
      reporterName: "Suresh K.",
      userCategory: "Waste & Sanitation",
      category: "Waste & Sanitation",
      priority: "Medium",
      urgencyScore: 67,
      recommendedDepartment: "Municipal Solid Waste & Sanitation",
      publicImpactReason:
        "Accumulating organic market waste blocks pedestrian access and creates localized hygiene and vector-borne health concerns.",
      citizenSummary:
        "Overflowing market garbage bin blocking footpath at Gandhipuram 4th Street.",
      estimatedResolutionWindow: "12-24 hours",
      recommendedActions: [
        "Schedule priority compactor truck clearance on Ward 32 morning route.",
        "Sanitize surrounding footpath with disinfectant spray.",
        "Add a secondary bin during weekend market peak days.",
      ],
      safetyAdvisory:
        "Use the opposite footpath near the market lane until sanitation clearance is completed.",
      confidence: 95,
      aiSource: "gemini",
      aiModel: "gemini-3.8-flash",
      status: "In Progress",
      createdAt: hoursAgo(22),
      updatedAt: hoursAgo(6),
      timeline: [
        {
          timestamp: hoursAgo(22),
          status: "Reported",
          actor: "Citizen",
          note: "Reported overflowing bin behind Gandhipuram vegetable market.",
        },
        {
          timestamp: hoursAgo(22),
          status: "Reported",
          actor: "Gemini AI",
          note: "Assigned Medium urgency (67/100) to Municipal Solid Waste & Sanitation.",
        },
        {
          timestamp: hoursAgo(6),
          status: "In Progress",
          actor: "Municipal Admin",
          note: "Sanitation vehicle TN-38-G-4412 assigned for clearance and bleaching.",
        },
      ],
    },
    {
      id: "CR-2026-1005",
      title: "Stormwater grate clogged with leaves and plastic debris",
      description:
        "Roadside stormwater drain near the park entrance is completely choked, causing ankle-deep waterlogging even during light drizzle.",
      location: "Race Course Walking Track South Gate, Ward 21",
      reporterName: "Deepak V.",
      userCategory: "Water & Drainage",
      category: "Water & Drainage",
      priority: "Low",
      urgencyScore: 44,
      recommendedDepartment: "Water Supply & Sewerage Board",
      publicImpactReason:
        "Localized minor waterlogging during rainfall; quick preventive desilting avoids mosquito breeding and sidewalk damage.",
      citizenSummary:
        "Clogged stormwater grate causing minor waterlogging at Race Course South Gate.",
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
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(10),
      timeline: [
        {
          timestamp: hoursAgo(48),
          status: "Reported",
          actor: "Citizen",
          note: "Reported clogged stormwater drain near Race Course South Gate.",
        },
        {
          timestamp: hoursAgo(48),
          status: "Reported",
          actor: "Gemini AI",
          note: "Classified as Low priority Water & Drainage issue (44/100).",
        },
        {
          timestamp: hoursAgo(26),
          status: "In Progress",
          actor: "Municipal Admin",
          note: "Desilting crew scheduled for afternoon maintenance.",
        },
        {
          timestamp: hoursAgo(10),
          status: "Resolved",
          actor: "Municipal Admin",
          note: "Drain cleared, silt removed, and flow tested successfully.",
        },
      ],
    },
  ];
}

let issuesCache: CivicIssue[] | null = null;
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
    // Fall back to fresh seeded state if temp store cannot be read
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
    // Non-fatal in read-only environments; in-memory state remains active
  }
}

export function isValidIssueId(id: string): boolean {
  return ISSUE_ID_PATTERN.test(id);
}

export function listIssues(filters?: {
  status?: IssueStatus | "All";
  priority?: IssuePriority | "All";
  search?: string;
}): CivicIssue[] {
  const all = [...loadStore()];
  let filtered = all;

  if (filters?.status && filters.status !== "All") {
    filtered = filtered.filter((i) => i.status === filters.status);
  }
  if (filters?.priority && filters.priority !== "All") {
    filtered = filtered.filter((i) => i.priority === filters.priority);
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

  return filtered.sort((a, b) => {
    if (a.status === "Resolved" && b.status !== "Resolved") return 1;
    if (a.status !== "Resolved" && b.status === "Resolved") return -1;
    return b.urgencyScore - a.urgencyScore;
  });
}

export function getIssueById(id: string): CivicIssue | undefined {
  return loadStore().find((i) => i.id === id);
}

export function createIssue(
  data: Omit<CivicIssue, "id" | "status" | "createdAt" | "updatedAt" | "timeline">
): CivicIssue {
  const store = loadStore();
  sequenceCounter += 1;
  const id = `CR-2026-${String(sequenceCounter).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const issue: CivicIssue = {
    ...data,
    id,
    status: "Reported",
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
        status: "Reported",
        actor: "Gemini AI",
        note: `Classified as ${data.priority} ${data.category} (${data.urgencyScore}/100) and routed to ${data.recommendedDepartment}.`,
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
    recommendedDepartment?: MunicipalDepartment;
    adminNote?: string;
  }
): CivicIssue | null {
  const store = loadStore();
  const idx = store.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const existing = store[idx];
  const now = new Date().toISOString();
  const nextStatus = updates.status ?? existing.status;

  const changeNotes: string[] = [];
  if (updates.status && updates.status !== existing.status) {
    changeNotes.push(`Status changed from ${existing.status} to ${updates.status}.`);
  }
  if (updates.priority && updates.priority !== existing.priority) {
    changeNotes.push(`Priority updated to ${updates.priority}.`);
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

  const updated: CivicIssue = {
    ...existing,
    status: nextStatus,
    priority: updates.priority ?? existing.priority,
    recommendedDepartment:
      updates.recommendedDepartment ?? existing.recommendedDepartment,
    updatedAt: now,
    timeline: [
      ...existing.timeline,
      {
        timestamp: now,
        status: nextStatus,
        actor: "Municipal Admin",
        note: changeNotes.join(" ") || "Ticket reviewed by municipal administrator.",
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

export function computeIssueStats(issues?: CivicIssue[]): IssueStats {
  const list = issues ?? loadStore();
  const total = list.length;
  const reported = list.filter((i) => i.status === "Reported").length;
  const inProgress = list.filter((i) => i.status === "In Progress").length;
  const resolved = list.filter((i) => i.status === "Resolved").length;
  const criticalAndHigh = list.filter(
    (i) => i.status !== "Resolved" && (i.priority === "Critical" || i.priority === "High")
  ).length;

  const byCategory: Record<string, number> = {};
  for (const item of list) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total,
    reported,
    inProgress,
    resolved,
    criticalAndHigh,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    byCategory,
  };
}

export function resetIssueStoreForTests(): void {
  sequenceCounter = 1005;
  issuesCache = createSeedIssues();
}
