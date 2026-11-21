import { NextResponse } from "next/server";
import { classifyCivicIssue } from "@/lib/civic-ai";
import { TriageRequestSchema } from "@/lib/civic-schemas";
import { checkRateLimit, getClientIdentifier, sanitizeApiError } from "@/lib/security";

export const maxDuration = 60;

const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`ai-triage:${getClientIdentifier(req)}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit reached. Please wait a few seconds before re-analyzing." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = TriageRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid complaint input." },
        { status: 400 }
      );
    }

    if (
      parsed.data.imageBase64 &&
      parsed.data.imageBase64.length > MAX_IMAGE_BASE64_LENGTH
    ) {
      return NextResponse.json(
        { error: "Uploaded image is too large. Keep images under 6 MB." },
        { status: 413 }
      );
    }

    const result = await classifyCivicIssue(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/ai/triage] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
