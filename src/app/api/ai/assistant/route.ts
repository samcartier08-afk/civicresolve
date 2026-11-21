import { getGeminiClient, resolveModel } from "@/lib/gemini";
import { AssistantRequestSchema } from "@/lib/civic-schemas";
import { computeIssueStats } from "@/lib/issue-store";
import {
  checkRateLimit,
  getClientIdentifier,
  sanitizeApiError,
} from "@/lib/security";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`ai-assistant:${getClientIdentifier(req)}`, 25, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many messages. Please wait a few seconds." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = AssistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Invalid message." },
        { status: 400 }
      );
    }

    const stats = computeIssueStats();
    const systemInstruction = `You are the CivicResolve Citizen & Municipal Helper powered by Google Gemini.
Help citizens identify the right municipal department, write clear actionable civic complaints, understand safety precautions, and interpret complaint status updates.
Current live platform snapshot: ${stats.total} total issues (${stats.reported} Reported, ${stats.inProgress} In Progress, ${stats.resolved} Resolved, ${stats.criticalAndHigh} active Critical/High priority).
Keep answers concise, empathetic, and structured with clear bullet points.`;

    const client = getGeminiClient();
    const model = resolveModel(false);

    const stream = await client.interactions.create({
      model,
      system_instruction: systemInstruction,
      input: parsed.data.prompt,
      previous_interaction_id: parsed.data.previousInteractionId || undefined,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          let interactionId: string | undefined;

          for await (const event of stream) {
            if (event.event_type === "interaction.created" && "interaction" in event) {
              interactionId = event.interaction?.id;
            } else if (
              event.event_type === "step.delta" &&
              "delta" in event &&
              event.delta?.type === "text" &&
              event.delta.text
            ) {
              send({ type: "delta", text: event.delta.text });
            } else if (
              event.event_type === "interaction.completed" &&
              "interaction" in event
            ) {
              interactionId = event.interaction?.id ?? interactionId;
              send({
                type: "done",
                model,
                interactionId: interactionId ?? null,
              });
            }
          }
        } catch (streamErr) {
          console.error("[POST /api/ai/assistant] Stream error:", streamErr);
          const { message } = sanitizeApiError(streamErr);
          send({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[POST /api/ai/assistant] Error:", err);
    const { message, status } = sanitizeApiError(err);
    return Response.json({ error: message }, { status });
  }
}
