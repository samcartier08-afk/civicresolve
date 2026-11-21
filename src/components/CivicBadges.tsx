"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { IssuePriority, IssueStatus } from "@/lib/civic-schemas";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const styles: Record<IssuePriority, string> = {
    Low: "border-slate-400/40 bg-slate-500/15 text-slate-100",
    Medium: "border-amber-400/50 bg-amber-500/15 text-amber-100",
    High: "border-orange-400/50 bg-orange-500/20 text-orange-100",
    Critical: "border-rose-400/60 bg-rose-500/25 text-rose-100",
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
  const isResolved =
    status === "Resolved" || status === "Citizen Verified" || status === "Closed";
  const isRejected = status === "Rejected" || status === "needs_manual_review";
  const isReopened = status === "Reopened" || status === "Escalated";

  const style =
    status === "Citizen Verified"
      ? "border-emerald-300/60 bg-emerald-500/25 text-emerald-100"
      : isResolved
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : isRejected
          ? "border-rose-400/40 bg-rose-500/15 text-rose-100"
          : isReopened
            ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
            : status === "Reported" || status === "AI Analyzed" || status === "Matched/Created"
              ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
              : "border-violet-400/40 bg-violet-500/15 text-violet-100";

  const Icon =
    status === "Citizen Verified"
      ? ShieldCheck
      : isResolved
        ? CheckCircle2
        : isRejected
          ? XCircle
          : isReopened
            ? RotateCcw
            : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </span>
  );
}

const LIFECYCLE_STAGES = [
  "Reported",
  "Assigned / In Progress",
  "Resolved",
  "Citizen Verified",
] as const;

export function ResolutionStepper({ status }: { status: IssueStatus }) {
  const activeIndex =
    status === "Citizen Verified" || status === "Closed"
      ? 3
      : status === "Resolved"
        ? 2
        : status === "Reported" || status === "AI Analyzed" || status === "Matched/Created"
          ? 0
          : 1;

  return (
    <ol
      aria-label={`Incident lifecycle progress: ${status}`}
      className="grid grid-cols-4 gap-1.5 pt-1"
    >
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const completed = idx <= activeIndex;
        const current = idx === activeIndex;
        return (
          <li
            key={stage}
            aria-current={current ? "step" : undefined}
            className="flex flex-col gap-1"
          >
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                completed
                  ? activeIndex >= 2
                    ? "bg-emerald-400"
                    : "bg-indigo-400"
                  : "bg-white/10"
              }`}
            />
            <span
              className={`text-[10px] font-medium leading-tight ${
                completed ? "text-slate-100" : "text-slate-400"
              }`}
            >
              {stage}
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
        <span className="text-slate-300">Priority Score</span>
        <span className="font-semibold text-white">{score}/100</span>
      </div>
      <div
        role="progressbar"
        aria-label="Priority score"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
