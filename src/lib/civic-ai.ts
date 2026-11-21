import * as z from "zod";
import { getGeminiClient, isApiKeyConfigured, resolveModel } from "./gemini.ts";
import {
  AiTriageSchema,
  AdminBriefingSchema,
  type AiTriageResult,
  type AdminBriefing,
  type CivicCategory,
  type CivicIssue,
  type MunicipalDepartment,
} from "./civic-schemas.ts";

const TRIAGE_SYSTEM_INSTRUCTION = `You are CivicResolve AI, a municipal triage specialist assisting city authorities and citizens in India.
Analyze the citizen's civic complaint (and attached photo, if provided) to:
1. Identify the exact civic category (even if the user selected 'Auto' or chose an imprecise category).
2. Assess urgency/priority (Low, Medium, High, Critical) and numeric urgencyScore (1-100) based on public safety risk, traffic/school/hospital proximity, utility outage, or flooding.
3. Recommend the single best municipal department.
4. Provide concise, practical crew actions, a realistic SLA resolution window, and a brief citizen safety advisory.
Be concise, objective, and accurate.`;

const BRIEFING_SYSTEM_INSTRUCTION = `You are a Municipal Operations Director AI. Review the active civic complaints and produce a sharp, actionable daily dispatch briefing prioritizing public safety and rapid resolution.`;

export interface TriageInput {
  title: string;
  description: string;
  location: string;
  userCategory?: CivicCategory | "Auto";
  imageBase64?: string;
  imageMimeType?: string;
}

export interface TriageOutput {
  triage: AiTriageResult;
  aiSource: "gemini" | "fallback";
  aiModel: string;
  totalTokens: number | null;
}

/**
 * Deterministic safety-net classifier used ONLY when GEMINI_API_KEY is unset
 * or transiently unreachable, ensuring zero-crash resilience.
 */
export function fallbackClassifyIssue(input: TriageInput): AiTriageResult {
  const issueText = `${input.title} ${input.description}`.toLowerCase();
  const combined = `${issueText} ${input.location}`.toLowerCase();

  let category: CivicCategory =
    input.userCategory && input.userCategory !== "Auto" ? input.userCategory : "Other";
  let department: MunicipalDepartment = "General Municipal Grievance Cell";

  if (/streetlight|lamp|light|dark|electric|wire|pole|transformer|power/.test(issueText)) {
    category = "Streetlights & Electricity";
    department = "Electricity & Streetlighting Board";
  } else if (/water|pipe|leak|drain|flood|sewer|manhole|gutter|stagnant/.test(issueText)) {
    category = "Water & Drainage";
    department = "Water Supply & Sewerage Board";
  } else if (/garbage|trash|waste|dump|bin|sanitation|smell|litter|sewage odor/.test(issueText)) {
    category = "Waste & Sanitation";
    department = "Municipal Solid Waste & Sanitation";
  } else if (/pothole|crater|asphalt|crack|footpath|bridge|flyover|sinkhole|road condition|damaged road/.test(issueText)) {
    category = "Roads & Potholes";
    department = "Public Works & Roads Department (PWD)";
  } else if (/tree|park|branch|garden|fallen tree|green/.test(issueText)) {
    category = "Parks & Environment";
    department = "Parks, Horticulture & Urban Forestry";
  } else if (/signal|accident|danger|unsafe|encroach|stray|hazard|traffic/.test(issueText)) {
    category = "Public Safety";
    department = "Traffic & Public Safety Authority";
  }

  let priority: AiTriageResult["priority"] = "Medium";
  let urgencyScore = 58;
  let sla = "2-3 business days";

  if (/live wire|electroc|burst|flood|open manhole|sinkhole|school|hospital|accident|fallen pole|critical|emergency/.test(combined)) {
    priority = "Critical";
    urgencyScore = 92;
    sla = "4-8 hours (Emergency)";
  } else if (/deep|dark|blocked|overflow|broken|major|main road|junction|days|weeks/.test(combined)) {
    priority = "High";
    urgencyScore = 78;
    sla = "24-48 hours";
  } else if (/minor|small|cosmetic|paint|trim/.test(combined)) {
    priority = "Low";
    urgencyScore = 32;
    sla = "5-7 business days";
  }

  return {
    category,
    priority,
    urgencyScore,
    recommendedDepartment: department,
    publicImpactReason: `Classified under ${category} with ${priority} urgency based on reported location impact (${input.location}) and public safety indicators.`,
    citizenSummary: `${priority}-priority ${category.toLowerCase()} issue reported at ${input.location}: ${input.title}.`,
    estimatedResolutionWindow: sla,
    recommendedActions: [
      `Dispatch inspection team from ${department} to ${input.location}.`,
      "Verify site safety, barricade hazard zone if required, and log photo evidence.",
      "Complete permanent remediation and update status to Resolved.",
    ],
    safetyAdvisory:
      priority === "Critical" || priority === "High"
        ? "Exercise caution near the reported site and avoid direct contact with the hazard until crews arrive."
        : "No immediate safety hazard reported; avoid obstructing maintenance access.",
    confidence: 76,
  };
}

export async function classifyCivicIssue(input: TriageInput): Promise<TriageOutput> {
  const model = resolveModel(false);

  if (!isApiKeyConfigured()) {
    return {
      triage: fallbackClassifyIssue(input),
      aiSource: "fallback",
      aiModel: "rule-based-fallback",
      totalTokens: null,
    };
  }

  try {
    const client = getGeminiClient();
    const jsonSchema = z.toJSONSchema(AiTriageSchema);

    const promptText = [
      `Complaint Title: ${input.title}`,
      `Location: ${input.location}`,
      `User-Selected Category: ${input.userCategory || "Auto"}`,
      `Description: ${input.description}`,
      input.imageBase64
        ? "An image of the civic issue is attached. Factor visual severity and hazards into your classification and urgency."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const inputParts: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mime_type: string }
    > = [{ type: "text", text: promptText }];

    if (input.imageBase64 && input.imageMimeType) {
      inputParts.push({
        type: "image",
        data: input.imageBase64,
        mime_type: input.imageMimeType,
      });
    }

    const interaction = await client.interactions.create({
      model,
      system_instruction: TRIAGE_SYSTEM_INSTRUCTION,
      input: inputParts,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: jsonSchema,
      },
    });

    const rawText = interaction.output_text;
    if (!rawText) {
      throw new Error("Empty response from Gemini triage.");
    }

    const triage = AiTriageSchema.parse(JSON.parse(rawText));
    return {
      triage,
      aiSource: "gemini",
      aiModel: model,
      totalTokens: interaction.usage?.total_tokens ?? null,
    };
  } catch (err) {
    console.error("[classifyCivicIssue] Gemini call failed, using fallback:", err);
    return {
      triage: fallbackClassifyIssue(input),
      aiSource: "fallback",
      aiModel: "rule-based-fallback",
      totalTokens: null,
    };
  }
}

export async function generateAdminBriefing(
  issues: CivicIssue[],
  useDeepReasoning = false
): Promise<{
  briefing: AdminBriefing;
  aiSource: "gemini" | "fallback";
  aiModel: string;
}> {
  const openIssues = issues
    .filter((i) => i.status !== "Resolved")
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 15);

  const fallbackBriefing = (): AdminBriefing => {
    const top = openIssues.slice(0, 3);
    return {
      headline: `${openIssues.length} active civic complaints require attention, led by ${
        top[0]?.priority ?? "standard"
      }-priority incidents.`,
      topPriorities:
        top.length > 0
          ? top.map((issue) => ({
              issueId: issue.id,
              reason: `${issue.priority} priority (score ${issue.urgencyScore}/100) at ${issue.location}.`,
              crewAction:
                issue.recommendedActions[0] ||
                `Assign ${issue.recommendedDepartment} immediately.`,
            }))
          : [
              {
                issueId: "NONE",
                reason: "All currently reported complaints have been resolved.",
                crewAction: "Continue routine preventive ward inspections.",
              },
            ],
      departmentWorkloadSummary:
        "Prioritize Critical and High urgency tickets first to minimize public safety risks. Coordinate PWD and Water Supply crews where road and drainage incidents overlap.",
      citizenCommunicationTip:
        "Publish live progress updates on In-Progress tickets so residents can track estimated repair times.",
    };
  };

  if (!isApiKeyConfigured() || openIssues.length === 0) {
    return {
      briefing: fallbackBriefing(),
      aiSource: "fallback",
      aiModel: "rule-based-fallback",
    };
  }

  const model = resolveModel(useDeepReasoning);
  try {
    const client = getGeminiClient();
    const jsonSchema = z.toJSONSchema(AdminBriefingSchema);

    const summaryPayload = openIssues.map((i) => ({
      id: i.id,
      title: i.title,
      location: i.location,
      category: i.category,
      priority: i.priority,
      urgencyScore: i.urgencyScore,
      status: i.status,
      department: i.recommendedDepartment,
    }));

    const interaction = await client.interactions.create({
      model,
      system_instruction: BRIEFING_SYSTEM_INSTRUCTION,
      input: `Active civic complaints JSON:\n${JSON.stringify(summaryPayload)}`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: jsonSchema,
      },
    });

    const rawText = interaction.output_text;
    if (!rawText) throw new Error("Empty briefing response.");

    const briefing = AdminBriefingSchema.parse(JSON.parse(rawText));
    return { briefing, aiSource: "gemini", aiModel: model };
  } catch (err) {
    console.error("[generateAdminBriefing] Gemini failed, using fallback:", err);
    return {
      briefing: fallbackBriefing(),
      aiSource: "fallback",
      aiModel: "rule-based-fallback",
    };
  }
}
