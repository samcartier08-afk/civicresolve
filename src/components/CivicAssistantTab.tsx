"use client";

import { useState } from "react";
import { AlertCircle, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { FOCUS_RING } from "./CivicBadges";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const SUGGESTED_QUESTIONS = [
  "Which municipal department handles a broken streetlight with loose wires?",
  "Help me write a clear complaint about an overflowing storm drain on my street.",
  "What safety precautions should residents take near a burst water pipeline?",
];

export function CivicAssistantTab() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previousInteractionId, setPreviousInteractionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(customPrompt?: string) {
    const text = (customPrompt ?? input).trim();
    if (!text || streaming) return;

    setInput("");
    setError(null);
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          previousInteractionId: previousInteractionId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Unable to reach Civic AI Helper.");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming response unavailable.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());

          if (payload.type === "delta" && payload.text) {
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              if (idx >= 0 && updated[idx].role === "assistant") {
                updated[idx] = {
                  ...updated[idx],
                  text: updated[idx].text + payload.text,
                };
              }
              return updated;
            });
          } else if (payload.type === "done" && payload.interactionId) {
            setPreviousInteractionId(payload.interactionId);
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Assistant stream interrupted.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete request.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section
      aria-label="CivicResolve AI Assistant"
      className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="h-4 w-4 text-indigo-300" aria-hidden="true" />
            CivicResolve AI Citizen Helper
          </h2>
          <p className="text-xs text-slate-300">
            Real-time Gemini streaming assistant for drafting complaints, department lookup, and safety guidance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setPreviousInteractionId(null);
            setError(null);
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 ${FOCUS_RING}`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Civic assistant conversation"
        className="mb-4 space-y-3 overflow-y-auto pr-1"
        style={{ minHeight: "320px", maxHeight: "460px" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-slate-100">
              Need help reporting or routing a civic issue?
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className={`rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:border-indigo-400/50 hover:bg-indigo-500/15 ${FOCUS_RING}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "border border-white/10 bg-slate-950/80 text-slate-100"
              }`}
            >
              {msg.text || (
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Responding...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2"
      >
        <label htmlFor="civic-chat-input" className="sr-only">
          Ask CivicResolve AI Helper
        </label>
        <input
          id="civic-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about departments, emergency steps, or how to describe a civic issue..."
          className={`flex-1 rounded-xl border border-white/15 bg-slate-950/75 px-4 py-2.5 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Send
        </button>
      </form>
    </section>
  );
}
