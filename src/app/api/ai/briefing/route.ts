import { NextResponse } from "next/server";
import { generateAdminBriefing } from "@/lib/civic-ai";
import { listIssues } from "@/lib/issue-store";
import { checkRateLimit, getClientIdentifier, sanitizeApiError } from "@/lib/security";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`ai-briefing:${getClientIdentifier(req)}`, 10, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Briefing rate limit reached. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const useDeepReasoning = Boolean(body?.useDeepReasoning);

    const issues = listIssues();
    const result = await generateAdminBriefing(issues, useDeepReasoning);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/ai/briefing] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
