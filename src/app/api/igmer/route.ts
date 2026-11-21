import { NextResponse } from "next/server";
import {
  getIgmerStateSnapshot,
  ingestCitizenReport,
  processOutboxEvent,
  resolveMediumConfidenceReview,
  runConcurrentLoadSimulation,
  setIgmerThresholds,
} from "@/lib/igmer-engine";
import { sanitizeApiError } from "@/lib/security";

export const maxDuration = 60;

export async function GET() {
  const snapshot = getIgmerStateSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === "INGEST_REPORT") {
      // Priority 1: Ingest-First persistence + Transactional Outbox in same transaction
      const ingested = ingestCitizenReport({
        idempotencyKey: body.idempotencyKey,
        reporterId: body.reporterId,
        reporterName: body.reporterName,
        title: String(body.title || ""),
        description: String(body.description || ""),
        location: String(body.location || ""),
        latitude: typeof body.latitude === "number" ? body.latitude : undefined,
        longitude: typeof body.longitude === "number" ? body.longitude : undefined,
        userCategory: body.userCategory,
        imageDataUrl: body.imageDataUrl,
      });

      // Trigger async outbox worker (unless caller explicitly requested to pause worker to inspect PENDING state)
      if (!body.deferAsyncWorker && !ingested.deduplicated) {
        await processOutboxEvent(ingested.outboxEvent.eventId, {
          simulateGeminiFailure: Boolean(body.simulateGeminiFailure),
          simulateImageFailure: Boolean(body.simulateImageFailure),
          simulateEmbeddingFailure: Boolean(body.simulateEmbeddingFailure),
          simulateMatchingFailure: Boolean(body.simulateMatchingFailure),
        });
      }

      return NextResponse.json(
        {
          ingestedReceipt: {
            reportId: ingested.report.reportId,
            outboxEventId: ingested.outboxEvent.eventId,
            deduplicated: ingested.deduplicated,
            persistedAt: ingested.report.createdAt,
          },
          snapshot: getIgmerStateSnapshot(),
        },
        { status: ingested.deduplicated ? 200 : 201 }
      );
    }

    if (action === "RETRY_OUTBOX") {
      const eventId = String(body.eventId || "");
      await processOutboxEvent(eventId, {});
      return NextResponse.json({ snapshot: getIgmerStateSnapshot() });
    }

    if (action === "RESOLVE_REVIEW") {
      const reportId = String(body.reportId || "");
      const decision =
        body.decision === "CONFIRM_MERGE" ? "CONFIRM_MERGE" : "CREATE_SEPARATE";
      await resolveMediumConfidenceReview(reportId, decision);
      return NextResponse.json({ snapshot: getIgmerStateSnapshot() });
    }

    if (action === "UPDATE_THRESHOLDS") {
      setIgmerThresholds({
        highConfidence:
          typeof body.highConfidence === "number" ? body.highConfidence : undefined,
        mediumConfidence:
          typeof body.mediumConfidence === "number" ? body.mediumConfidence : undefined,
        maxCandidateRadiusMeters:
          typeof body.maxCandidateRadiusMeters === "number"
            ? body.maxCandidateRadiusMeters
            : undefined,
      });
      return NextResponse.json({ snapshot: getIgmerStateSnapshot() });
    }

    if (action === "SIMULATE_50") {
      const scenario =
        body.scenario === "TWO_COLOCATED_INCIDENTS_50"
          ? "TWO_COLOCATED_INCIDENTS_50"
          : body.scenario === "FAULT_RESILIENCE_50"
            ? "FAULT_RESILIENCE_50"
            : "SINGLE_INCIDENT_50";

      const simulationResult = await runConcurrentLoadSimulation({
        scenario,
        totalReports: 50,
      });

      return NextResponse.json({
        simulationResult,
        snapshot: getIgmerStateSnapshot(),
      });
    }

    return NextResponse.json({ error: "Unsupported IGMER action." }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/igmer] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
