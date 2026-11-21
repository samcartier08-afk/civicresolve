import * as z from "zod";

export const CIVIC_CATEGORIES = [
  "Roads & Potholes",
  "Waste & Sanitation",
  "Streetlights & Electricity",
  "Water & Drainage",
  "Public Safety",
  "Parks & Environment",
  "Other",
] as const;

export const MUNICIPAL_DEPARTMENTS = [
  "Greater Chennai Corporation (GCC) — Storm Water Drain & Roads",
  "Chennai MetroWater (CMWSSB) — Water Supply & Sewerage",
  "TANGEDCO — Streetlighting & Electrical Distribution",
  "GCC Solid Waste Management & Conservancy",
  "Greater Chennai Traffic & Public Safety Wing",
  "GCC Parks & Urban Forestry Department",
  "Public Works & Roads Department (PWD)",
  "Municipal Solid Waste & Sanitation",
  "Electricity & Streetlighting Board",
  "Water Supply & Sewerage Board",
  "Traffic & Public Safety Authority",
  "Parks, Horticulture & Urban Forestry",
  "General Municipal Grievance Cell",
] as const;

export const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export const ISSUE_STATUSES = [
  "Reported",
  "AI Analyzed",
  "Matched/Created",
  "Under Review",
  "Assigned",
  "Accepted",
  "In Progress",
  "Resolved",
  "Citizen Verified",
  "Closed",
  "Rejected",
  "Escalated",
  "Reopened",
  "Awaiting Info",
  "needs_manual_review",
] as const;

export type CivicCategory = (typeof CIVIC_CATEGORIES)[number];
export type MunicipalDepartment = (typeof MUNICIPAL_DEPARTMENTS)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface JurisdictionRule {
  wardCode: string;
  wardName: string;
  zoneName: string;
  category: CivicCategory;
  department: MunicipalDepartment;
  slaHours: number;
  isSynthetic: true;
}

export const CHENNAI_SYNTHETIC_JURISDICTIONS: JurisdictionRule[] = [
  {
    wardCode: "GCC-W101",
    wardName: "Ward 101 — Anna Nagar East",
    zoneName: "Zone 8 (Anna Nagar)",
    category: "Water & Drainage",
    department: "Chennai MetroWater (CMWSSB) — Water Supply & Sewerage",
    slaHours: 6,
    isSynthetic: true,
  },
  {
    wardCode: "GCC-W126",
    wardName: "Ward 126 — Mandaveli / Mylapore",
    zoneName: "Zone 9 (Teynampet)",
    category: "Streetlights & Electricity",
    department: "TANGEDCO — Streetlighting & Electrical Distribution",
    slaHours: 4,
    isSynthetic: true,
  },
  {
    wardCode: "GCC-W136",
    wardName: "Ward 136 — T. Nagar / Pondy Bazaar",
    zoneName: "Zone 10 (Kodambakkam)",
    category: "Roads & Potholes",
    department: "Greater Chennai Corporation (GCC) — Storm Water Drain & Roads",
    slaHours: 24,
    isSynthetic: true,
  },
  {
    wardCode: "GCC-W173",
    wardName: "Ward 173 — Adyar / Besant Nagar",
    zoneName: "Zone 13 (Adyar)",
    category: "Waste & Sanitation",
    department: "GCC Solid Waste Management & Conservancy",
    slaHours: 12,
    isSynthetic: true,
  },
  {
    wardCode: "GCC-W192",
    wardName: "Ward 192 — Neelankarai / OMR IT Corridor",
    zoneName: "Zone 15 (Sholinganallur)",
    category: "Public Safety",
    department: "Greater Chennai Traffic & Public Safety Wing",
    slaHours: 8,
    isSynthetic: true,
  },
];

export const AiTriageSchema = z.object({
  category: z
    .enum(CIVIC_CATEGORIES)
    .describe("Best-matching standardized civic issue category."),
  priority: z
    .enum(ISSUE_PRIORITIES)
    .describe("Urgency level based on public safety risk, disruption, and severity."),
  urgencyScore: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("Numeric priority score from 1 (minor) to 100 (immediate life/safety hazard)."),
  recommendedDepartment: z
    .enum(MUNICIPAL_DEPARTMENTS)
    .describe("Most appropriate municipal department to own resolution."),
  publicImpactReason: z
    .string()
    .describe("1-2 crisp sentences explaining why this priority and department were chosen."),
  citizenSummary: z
    .string()
    .describe("Clear, formal 1-sentence dispatch summary for municipal crews."),
  estimatedResolutionWindow: z
    .string()
    .describe("Realistic SLA target, e.g. '4-6 hours (Emergency)', '24-48 hours', '3-5 days'."),
  recommendedActions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2-4 concrete field-crew steps to inspect and resolve the issue."),
  safetyAdvisory: z
    .string()
    .describe("Short safety tip for nearby citizens, or 'No immediate safety hazard reported.'"),
  confidence: z
    .number()
    .int()
    .min(50)
    .max(100)
    .describe("AI classification confidence percentage (50-100)."),
});

export type AiTriageResult = z.infer<typeof AiTriageSchema>;

export const TriageRequestSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(140),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue in at least 10 characters.")
    .max(4000),
  location: z
    .string()
    .trim()
    .min(3, "Please provide a street, ward, or landmark.")
    .max(200),
  userCategory: z.union([z.enum(CIVIC_CATEGORIES), z.literal("Auto")]).optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .optional(),
});

export const CreateIssueRequestSchema = TriageRequestSchema.extend({
  reporterName: z.string().trim().max(80).optional(),
  isAnonymous: z.boolean().optional(),
  locationConsent: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wardCode: z.string().max(40).optional(),
  imageDataUrl: z.string().max(8_500_000).optional(),
  mediaUrls: z.array(z.string().max(8_500_000)).max(4).optional(),
  precomputedTriage: AiTriageSchema.optional(),
  aiSource: z.enum(["gemini", "fallback"]).optional(),
  aiModel: z.string().max(80).optional(),
});

export const UpdateIssueRequestSchema = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    priority: z.enum(ISSUE_PRIORITIES).optional(),
    priorityOverrideReason: z.string().trim().max(300).optional(),
    recommendedDepartment: z.enum(MUNICIPAL_DEPARTMENTS).optional(),
    adminNote: z.string().trim().max(500).optional(),
    internalNote: z.string().trim().max(500).optional(),
    resolutionEvidenceUrl: z.string().max(8_500_000).optional(),
    citizenAction: z.enum(["VERIFY_RESOLUTION", "DISPUTE_REOPEN"]).optional(),
    citizenFeedback: z.string().trim().max(500).optional(),
    anonymousToken: z.string().trim().max(120).optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.status ||
          data.priority ||
          data.recommendedDepartment ||
          data.citizenAction ||
          (data.adminNote && data.adminNote.length > 0) ||
          (data.internalNote && data.internalNote.length > 0)
      ),
    { message: "Provide at least one field to update." }
  );

export const AdminBriefingSchema = z.object({
  headline: z.string().describe("1-line executive status summary for city leadership."),
  topPriorities: z
    .array(
      z.object({
        issueId: z.string().describe("Tracking ID like CR-2026-1001"),
        reason: z.string().describe("Why this issue must be dispatched first."),
        crewAction: z.string().describe("Immediate next step for the assigned department."),
      })
    )
    .min(1)
    .max(4),
  departmentWorkloadSummary: z
    .string()
    .describe("2 sentences highlighting bottlenecks and resource allocation advice."),
  citizenCommunicationTip: z
    .string()
    .describe("1 concise public advisory message to keep citizens informed."),
});

export type AdminBriefing = z.infer<typeof AdminBriefingSchema>;

export const AssistantRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Please enter a question.").max(4000),
  previousInteractionId: z.string().max(200).optional(),
});

export interface TimelineEvent {
  timestamp: string;
  prevStatus?: IssueStatus;
  status: IssueStatus;
  actor: "Citizen" | "Gemini AI" | "Municipal Admin" | "Authority Officer";
  note: string; // Public comment visible to citizens
  internalNote?: string; // Stripped from public citizen responses!
  evidenceUrl?: string;
}

export interface CitizenNotification {
  id: string;
  issueId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  wardCode?: string;
  latitude: number;
  longitude: number;
  locationConsent: boolean;
  reporterName: string;
  isAnonymous: boolean;
  anonymousTrackingToken?: string;
  userCategory: CivicCategory | "Auto";
  category: CivicCategory;
  priority: IssuePriority;
  urgencyScore: number;
  recommendedDepartment: MunicipalDepartment;
  publicImpactReason: string;
  citizenSummary: string;
  estimatedResolutionWindow: string;
  recommendedActions: string[];
  safetyAdvisory: string;
  confidence: number;
  aiSource: "gemini" | "fallback";
  aiModel: string;
  status: IssueStatus;
  imageDataUrl?: string;
  mediaUrls: string[];
  resolutionEvidenceUrl?: string;
  supportingReportCount: number;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface IssueStats {
  total: number;
  reported: number;
  inProgress: number;
  resolved: number;
  citizenVerified: number;
  criticalAndHigh: number;
  resolutionRate: number;
  byCategory: Record<string, number>;
  byDepartment: Record<string, number>;
  byWard: Record<string, number>;
}
