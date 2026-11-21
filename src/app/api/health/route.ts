import { NextResponse } from "next/server";
import { GEMINI_MODELS, isApiKeyConfigured } from "@/lib/gemini";
import { computeIssueStats } from "@/lib/issue-store";

export async function GET() {
  const stats = computeIssueStats();
  return NextResponse.json({
    ok: true,
    service: "CivicResolve",
    apiKeyConfigured: isApiKeyConfigured(),
    models: GEMINI_MODELS,
    totalIssues: stats.total,
    timestamp: new Date().toISOString(),
  });
}
