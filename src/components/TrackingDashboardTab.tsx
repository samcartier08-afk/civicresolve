"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type CivicIssue,
  type IssuePriority,
  type IssueStats,
  type IssueStatus,
} from "@/lib/civic-schemas";
import {
  FOCUS_RING,
  PriorityBadge,
  ResolutionStepper,
  StatusBadge,
  UrgencyMeter,
} from "./CivicBadges";

interface TrackingDashboardTabProps {
  issues: CivicIssue[];
  stats: IssueStats;
  highlightedIssueId?: string | null;
}

export function TrackingDashboardTab({
  issues,
  stats,
  highlightedIssueId,
}: TrackingDashboardTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "All">("All");
  const [expandedId, setExpandedId] = useState<string | null>(highlightedIssueId ?? null);

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

  const categoryEntries = useMemo(
    () => Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]),
    [stats.byCategory]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Overview */}
      <section aria-label="Civic issue metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium text-slate-300">Total Complaints</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
          <p className="mt-0.5 text-xs text-slate-400">{stats.reported} awaiting dispatch</p>
        </div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
          <p className="text-xs font-medium text-rose-200">Active High / Critical</p>
          <p className="mt-1 text-2xl font-bold text-rose-100">{stats.criticalAndHigh}</p>
          <p className="mt-0.5 text-xs text-rose-200/80">Prioritized by Gemini AI</p>
        </div>
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
          <p className="text-xs font-medium text-violet-200">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-violet-100">{stats.inProgress}</p>
          <p className="mt-0.5 text-xs text-violet-200/80">Field crews dispatched</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
          <p className="text-xs font-medium text-emerald-200">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-100">
            {stats.resolved}{" "}
            <span className="text-sm font-medium text-emerald-300">
              ({stats.resolutionRate}%)
            </span>
          </p>
          <p className="mt-0.5 text-xs text-emerald-200/80">Verified municipal closures</p>
        </div>
      </section>

      {/* Category Distribution Bar */}
      {categoryEntries.length > 0 && (
        <section
          aria-label="Complaints by civic category"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            Issue Distribution by Category
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryEntries.map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs"
              >
                <span className="text-slate-200">{cat}</span>
                <span className="rounded-full bg-indigo-500/25 px-2 py-0.5 font-bold text-indigo-200">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>
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
            placeholder="Search by ID (CR-2026-...), location, category, or department..."
            className={`w-full rounded-xl border border-white/15 bg-slate-950/75 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-400 ${FOCUS_RING}`}
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
            className={`rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-medium text-white ${FOCUS_RING}`}
          >
            <option value="All">All Statuses</option>
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
            className={`rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-medium text-white ${FOCUS_RING}`}
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
            No civic complaints match your current filter.
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isExpanded = expandedId === issue.id;
            const isHighlighted = highlightedIssueId === issue.id;

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
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-64">
                    <ResolutionStepper status={issue.status} />
                    <UrgencyMeter score={issue.urgencyScore} />
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
                    >
                      {isExpanded ? (
                        <>
                          Hide AI Details & Timeline
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          View AI Details & Timeline ({issue.timeline.length})
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
                    {/* AI Analysis Breakdown */}
                    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-200">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          Gemini AI Assessment
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          {issue.aiModel} · {issue.confidence}% conf.
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-200">
                        {issue.publicImpactReason}
                      </p>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                          Recommended Dispatch Steps
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-xs text-slate-200">
                          {issue.recommendedActions.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                      {issue.imageDataUrl && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                            Citizen Photo
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={issue.imageDataUrl}
                            alt={`Submitted evidence for ${issue.id}`}
                            className="max-h-40 rounded-lg border border-white/10 object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Audit Timeline */}
                    <div className="space-y-2.5 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Resolution Audit Timeline
                      </h4>
                      <ol className="space-y-2.5">
                        {issue.timeline.map((event, idx) => (
                          <li
                            key={idx}
                            className="border-l-2 border-indigo-400/40 pl-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{event.actor}</span>
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
