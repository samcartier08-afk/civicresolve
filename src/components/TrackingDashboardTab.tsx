"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type CitizenNotification,
  type CivicIssue,
  type IssuePriority,
  type IssueStats,
  type IssueStatus,
} from "@/lib/civic-schemas";
import type { UiTranslations } from "@/lib/i18n";
import {
  FOCUS_RING,
  PriorityBadge,
  ResolutionStepper,
  StatusBadge,
  UrgencyMeter,
} from "./CivicBadges";

interface TrackingDashboardTabProps {
  t: UiTranslations;
  issues: CivicIssue[];
  stats: IssueStats;
  notifications: CitizenNotification[];
  highlightedIssueId?: string | null;
  onIssueUpdated: (issue: CivicIssue, stats: IssueStats) => void;
}

export function TrackingDashboardTab({
  t,
  issues,
  notifications,
  highlightedIssueId,
  onIssueUpdated,
}: TrackingDashboardTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(highlightedIssueId ?? null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (statusFilter !== "All" && issue.status !== statusFilter) return false;
      if (priorityFilter !== "All" && issue.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        issue.id.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        issue.location.toLowerCase().includes(q) ||
        issue.category.toLowerCase().includes(q) ||
        issue.recommendedDepartment.toLowerCase().includes(q)
      );
    });
  }, [issues, search, statusFilter, priorityFilter]);

  async function handleCitizenVerification(
    issueId: string,
    citizenAction: "VERIFY_RESOLUTION" | "DISPUTE_REOPEN"
  ) {
    setVerifyingId(issueId);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenAction,
          citizenFeedback:
            citizenAction === "VERIFY_RESOLUTION"
              ? "Citizen verified on site that the issue has been resolved."
              : "Citizen reported that the problem persists on site and reopened the incident.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.issue) {
        onIssueUpdated(data.issue, data.stats);
        setFeedbackMessage(
          citizenAction === "VERIFY_RESOLUTION"
            ? `Thank you! Incident ${issueId} is now marked Citizen Verified.`
            : `Incident ${issueId} has been Reopened and escalated back to the authority queue.`
        );
      }
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* In-App Citizen Notifications Banner */}
      {notifications.length > 0 && (
        <section
          aria-label="In-app citizen notifications"
          className="rounded-2xl border border-indigo-400/35 bg-indigo-500/10 p-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-200">
            <Bell className="h-4 w-4 text-indigo-300" aria-hidden="true" />
            Citizen Resolution Alerts ({notifications.length})
          </div>
          <div className="mt-2 space-y-2">
            {notifications.slice(0, 2).map((notif) => (
              <div
                key={notif.id}
                className="flex flex-col justify-between gap-2 rounded-xl bg-slate-950/70 p-3 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-semibold text-white">{notif.title}</p>
                  <p className="text-slate-300">{notif.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(notif.issueId)}
                  className={`min-h-[38px] shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 ${FOCUS_RING}`}
                >
                  Review {notif.issueId}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-xs font-medium text-emerald-100"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Search & Filters */}
      <section
        aria-label="Filter tracked complaints"
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="tracker-search" className="sr-only">
            Search by tracking ID, title, location, or department
          </label>
          <input
            id="tracker-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Tracking ID (CR-2026-...), landmark, or category..."
            className={`min-h-[44px] w-full rounded-xl border border-white/15 bg-slate-950/75 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <label htmlFor="tracker-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="tracker-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IssueStatus | "All")}
            className={`min-h-[44px] rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-medium text-white ${FOCUS_RING}`}
          >
            <option value="All">All Lifecycle States</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label htmlFor="tracker-priority-filter" className="sr-only">
            Filter by priority
          </label>
          <select
            id="tracker-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as IssuePriority | "All")}
            className={`min-h-[44px] rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-medium text-white ${FOCUS_RING}`}
          >
            <option value="All">All Priorities</option>
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Complaint Cards */}
      <section aria-label="Tracked civic issues list" className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-slate-300">
            {t.tracker.emptyState}
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isExpanded = expandedId === issue.id;
            const isHighlighted = highlightedIssueId === issue.id;
            const isVerifying = verifyingId === issue.id;

            return (
              <article
                key={issue.id}
                className={`rounded-2xl border p-5 transition ${
                  isHighlighted
                    ? "border-emerald-400/50 bg-emerald-500/[0.05]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-200">
                        {issue.id}
                      </span>
                      <StatusBadge status={issue.status} />
                      <PriorityBadge priority={issue.priority} />
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-200">
                        {issue.category}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {issue.supportingReportCount} report
                        {issue.supportingReportCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">{issue.title}</h3>
                    <p className="text-sm text-slate-300">{issue.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                        {issue.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                        {issue.recommendedDepartment}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        SLA: {issue.estimatedResolutionWindow}
                      </span>
                    </div>

                    {/* Citizen Resolution Verification Loop (Confirm vs Dispute & Reopen) */}
                    {issue.status === "Resolved" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3">
                        <span className="text-xs font-medium text-emerald-100">
                          Authority marked this problem Resolved. Is it fixed on site?
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() =>
                              handleCitizenVerification(issue.id, "VERIFY_RESOLUTION")
                            }
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 ${FOCUS_RING}`}
                          >
                            {isVerifying ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {t.tracker.verifyResolution}
                          </button>

                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() =>
                              handleCitizenVerification(issue.id, "DISPUTE_REOPEN")
                            }
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 ${FOCUS_RING}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            {t.tracker.disputeReopen}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-72">
                    <ResolutionStepper status={issue.status} />
                    <UrgencyMeter score={issue.urgencyScore} />
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
                    >
                      {isExpanded ? (
                        <>
                          Hide Public Updates
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          Public Updates & History ({issue.timeline.length})
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                        Public Routing & Safety Guidance
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-200">
                        {issue.citizenSummary}
                      </p>
                      <p className="text-xs text-amber-200">
                        <strong>Safety Note:</strong> {issue.safetyAdvisory}
                      </p>
                      {issue.mediaUrls && issue.mediaUrls.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {issue.mediaUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Evidence photo ${idx + 1} for ${issue.id}`}
                              className="h-28 w-full rounded-lg border border-white/10 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Public Status History (Internal authority notes are strictly excluded) */}
                    <div className="space-y-2.5 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Public Status History
                      </h4>
                      <ol className="space-y-2.5">
                        {issue.timeline.map((event, idx) => (
                          <li
                            key={idx}
                            className="border-l-2 border-indigo-400/40 pl-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{event.actor}</span>
                              {event.prevStatus && (
                                <span className="text-[10px] text-slate-400">
                                  {event.prevStatus} →
                                </span>
                              )}
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-200">
                                {event.status}
                              </span>
                              <time className="text-[11px] text-slate-400">
                                {new Date(event.timestamp).toLocaleString()}
                              </time>
                            </div>
                            <p className="mt-1 text-slate-300">{event.note}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
