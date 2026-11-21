"use client";

import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { IssuePriority, IssueStatus } from "@/lib/civic-schemas";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const styles: Record<IssuePriority, string> = {
    Low: "border-slate-500/40 bg-slate-500/15 text-slate-200",
    Medium: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    High: "border-orange-400/40 bg-orange-500/15 text-orange-200",
    Critical: "border-rose-400/50 bg-rose-500/20 text-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[priority]}`}
    >
      {(priority === "Critical" || priority === "High") && (
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      )}
      {priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const styles: Record<IssueStatus, string> = {
    Reported: "border-sky-400/40 bg-sky-500/15 text-sky-200",
    "In Progress": "border-violet-400/40 bg-violet-500/15 text-violet-200",
    Resolved: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  };

  const Icon =
    status === "Resolved"
      ? CheckCircle2
      : status === "In Progress"
        ? Clock
        : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </span>
  );
}

const STEPS: IssueStatus[] = ["Reported", "In Progress", "Resolved"];

export function ResolutionStepper({ status }: { status: IssueStatus }) {
  const activeIndex = STEPS.indexOf(status);

  return (
    <ol
      aria-label={`Issue progress: ${status}`}
      className="grid grid-cols-3 gap-2 pt-1"
    >
      {STEPS.map((step, idx) => {
        const completed = idx <= activeIndex;
        const current = idx === activeIndex;
        return (
          <li
            key={step}
            aria-current={current ? "step" : undefined}
            className="flex flex-col gap-1.5"
          >
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                completed
                  ? status === "Resolved"
                    ? "bg-emerald-400"
                    : "bg-indigo-400"
                  : "bg-white/10"
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                completed ? "text-slate-100" : "text-slate-400"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function UrgencyMeter({ score }: { score: number }) {
  const barColor =
    score >= 85
      ? "from-rose-500 to-orange-400"
      : score >= 65
        ? "from-orange-400 to-amber-400"
        : "from-sky-400 to-indigo-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">Urgency Score</span>
        <span className="font-semibold text-white">{score}/100</span>
      </div>
      <div
        role="progressbar"
        aria-label="Urgency score"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
