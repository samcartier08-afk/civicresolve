import { NextResponse } from "next/server";
import { GEMINI_MODELS, isApiKeyConfigured } from "@/lib/gemini";
import { computeIssueStats } from "@/lib/issue-store";
import { getMongoDbUriInfo } from "@/lib/mongodb";

export async function GET() {
  const stats = computeIssueStats();
  const mongo = getMongoDbUriInfo();
  const geminiReady = isApiKeyConfigured();

  return NextResponse.json({
    ok: true,
    service: "CivicResolve",
    apiKeyConfigured: geminiReady,
    geminiStatus: geminiReady ? "configured" : "fallback_active",
    models: GEMINI_MODELS,
    googleServices: {
      geminiApi: geminiReady,
      firebaseAuthConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
      cloudRunReady: true,
      mapsGeocodingConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      cloudTranslateConfigured: Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
    },
    database: {
      type: "PostgreSQL+PostGIS+pgvector / MongoDB + Transactional Outbox",
      mongoStatus: mongo,
    },
    totalIssues: stats.total,
    timestamp: new Date().toISOString(),
  });
}
