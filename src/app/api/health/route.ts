import { NextResponse } from "next/server";
import { GEMINI_MODELS, isApiKeyConfigured } from "@/lib/gemini";
import { computeIssueStats } from "@/lib/issue-store";
import { getMongoDbUriInfo } from "@/lib/mongodb";

export async function GET() {
  const stats = computeIssueStats();
  const mongo = getMongoDbUriInfo();
  return NextResponse.json({
    ok: true,
    service: "CivicResolve",
    apiKeyConfigured: isApiKeyConfigured(),
    models: GEMINI_MODELS,
    database: {
      type: "MongoDB + Transactional In-Memory Cache",
      mongoStatus: mongo,
    },
    totalIssues: stats.total,
    timestamp: new Date().toISOString(),
  });
}
