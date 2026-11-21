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
  "Public Works & Roads Department (PWD)",
  "Municipal Solid Waste & Sanitation",
  "Electricity & Streetlighting Board",
  "Water Supply & Sewerage Board",
  "Traffic & Public Safety Authority",
  "Parks, Horticulture & Urban Forestry",
  "General Municipal Grievance Cell",
] as const;

export const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const ISSUE_STATUSES = ["Reported", "In Progress", "Resolved"] as const;

export type CivicCategory = (typeof CIVIC_CATEGORIES)[number];
export type MunicipalDepartment = (typeof MUNICIPAL_DEPARTMENTS)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

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
  imageDataUrl: z.string().max(8_500_000).optional(),
  precomputedTriage: AiTriageSchema.optional(),
  aiSource: z.enum(["gemini", "fallback"]).optional(),
  aiModel: z.string().max(80).optional(),
});

export const UpdateIssueRequestSchema = z
  .object({
    status: z.enum(ISSUE_STATUSES).optional(),
    priority: z.enum(ISSUE_PRIORITIES).optional(),
    recommendedDepartment: z.enum(MUNICIPAL_DEPARTMENTS).optional(),
    adminNote: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.status ||
          data.priority ||
          data.recommendedDepartment ||
          (data.adminNote && data.adminNote.length > 0)
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
  status: IssueStatus;
  actor: "Citizen" | "Gemini AI" | "Municipal Admin";
  note: string;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  reporterName: string;
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
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface IssueStats {
  total: number;
  reported: number;
  inProgress: number;
  resolved: number;
  criticalAndHigh: number;
  resolutionRate: number;
  byCategory: Record<string, number>;
}
