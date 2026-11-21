"use client";

import { useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Download,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  MUNICIPAL_DEPARTMENTS,
  type AdminBriefing,
  type CivicIssue,
  type IssuePriority,
  type IssueStats,
  type IssueStatus,
  type MunicipalDepartment,
} from "@/lib/civic-schemas";
import { escapeCsvCell } from "@/lib/security";
import { FOCUS_RING, PriorityBadge, StatusBadge } from "./CivicBadges";

interface AdminDashboardTabProps {
  issues: CivicIssue[];
  onIssueUpdated: (issue: CivicIssue, stats: IssueStats) => void;
  onIssueDeleted: (id: string, stats: IssueStats) => void;
}

interface DraftState {
  status: IssueStatus;
  priority: IssuePriority;
  recommendedDepartment: MunicipalDepartment;
  adminNote: string;
}

export function AdminDashboardTab({
  issues,
  onIssueUpdated,
  onIssueDeleted,
}: AdminDashboardTabProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Executive AI Dispatch Briefing state
  const [useDeepReasoning, setUseDeepReasoning] = useState(false);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingData, setBriefingData] = useState<{
    briefing: AdminBriefing;
    aiModel: string;
    aiSource: "gemini" | "fallback";
  } | null>(null);

  function getDraft(issue: CivicIssue): DraftState {
    return (
      drafts[issue.id] ?? {
        status: issue.status,
        priority: issue.priority,
        recommendedDepartment: issue.recommendedDepartment,
        adminNote: "",
      }
    );
  }

  function updateDraft(issue: CivicIssue, patch: Partial<DraftState>) {
    const current = getDraft(issue);
    setDrafts((prev) => ({
      ...prev,
      [issue.id]: { ...current, ...patch },
    }));
  }

  async function handleSave(issue: CivicIssue) {
    const draft = getDraft(issue);
    setSavingId(issue.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          priority: draft.priority,
          recommendedDepartment: draft.recommendedDepartment,
          adminNote: draft.adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update issue.");

      onIssueUpdated(data.issue, data.stats);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[issue.id];
        return next;
      });
      setFeedback({
        type: "success",
        text: `Updated ${issue.id} (${data.issue.status}) and recorded change in citizen timeline.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save admin update.",
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/issues/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete issue.");

      onIssueDeleted(id, data.stats);
      setConfirmDeleteId(null);
      setFeedback({ type: "success", text: `Removed ticket ${id} from active queue.` });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Could not delete issue.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateBriefing() {
    setLoadingBriefing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDeepReasoning }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate dispatch briefing.");
      setBriefingData(data);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to generate briefing.",
      });
    } finally {
      setLoadingBriefing(false);
    }
  }

  function handleExportCsv() {
    const headers = [
      "Tracking ID",
      "Status",
      "Priority",
      "Urgency Score",
      "Category",
      "Department",
      "Title",
      "Location",
      "Reporter",
      "SLA Window",
      "Created At",
    ];
    const rows = issues.map((i) =>
      [
        i.id,
        i.status,
        i.priority,
        i.urgencyScore,
        i.category,
        i.recommendedDepartment,
        i.title,
        i.location,
        i.reporterName,
        i.estimatedResolutionWindow,
        i.createdAt,
      ]
        .map(escapeCsvCell)
        .join(",")
    );

    const csv = [headers.map(escapeCsvCell).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `civicresolve-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Admin Operations Toolbar */}
      <section
        aria-label="Municipal admin operations"
        className="flex flex-col gap-4 rounded-2xl border border-indigo-400/25 bg-indigo-500/[0.06] p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Municipal Operations & Dispatch Control
            </h2>
            <p className="text-xs text-slate-300">
              Complaints are auto-ranked by Gemini urgency score. Status and notes sync live to the Citizen Tracker.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={useDeepReasoning}
              onClick={() => setUseDeepReasoning((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
            >
              <Brain className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
              {useDeepReasoning ? "Deep Model: gemini-4-argon" : "Fast Model: gemini-3.8-flash"}
            </button>

            <button
              type="button"
              disabled={loadingBriefing}
              onClick={handleGenerateBriefing}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {loadingBriefing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Generating Briefing...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  AI Dispatch Briefing
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 ${FOCUS_RING}`}
            >
              <Download className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              Export CSV
            </button>
          </div>
        </div>

        {/* AI Executive Briefing Result */}
        {briefingData && (
          <div
            aria-live="polite"
            className="space-y-3 rounded-xl border border-indigo-400/30 bg-slate-950/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-white">{briefingData.briefing.headline}</p>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] text-indigo-200">
                {briefingData.aiModel}
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {briefingData.briefing.topPriorities.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs"
                >
                  <span className="font-mono font-bold text-indigo-300">{item.issueId}</span>
                  <p className="mt-1 text-slate-200">{item.reason}</p>
                  <p className="mt-1.5 font-medium text-cyan-200">Action: {item.crewAction}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-300">
              <strong className="text-slate-100">Resource Allocation:</strong>{" "}
              {briefingData.briefing.departmentWorkloadSummary}
            </p>
            <p className="text-xs text-emerald-200">
              <strong>Public Communication Advisory:</strong>{" "}
              {briefingData.briefing.citizenCommunicationTip}
            </p>
          </div>
        )}
      </section>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
            feedback.type === "success"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Admin Issue Management List */}
      <section aria-label="Manage reported civic complaints" className="space-y-4">
        {issues.map((issue) => {
          const draft = getDraft(issue);
          const isSaving = savingId === issue.id;
          const isDeleting = deletingId === issue.id;

          return (
            <article
              key={issue.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-200">
                      {issue.id}
                    </span>
                    <StatusBadge status={issue.status} />
                    <PriorityBadge priority={issue.priority} />
                    <span className="text-xs text-slate-300">
                      Score: <strong className="text-white">{issue.urgencyScore}/100</strong>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{issue.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-300">
                    {issue.location} · Reported by {issue.reporterName}
                  </p>
                </div>

                {confirmDeleteId === issue.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(issue.id)}
                      className={`rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 ${FOCUS_RING}`}
                    >
                      {isDeleting ? "Removing..." : "Confirm Remove"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className={`rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 ${FOCUS_RING}`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove complaint ${issue.id}`}
                    onClick={() => setConfirmDeleteId(issue.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/15 ${FOCUS_RING}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>

              {/* Admin Action Controls */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor={`status-${issue.id}`}
                    className="mb-1 block text-[11px] font-semibold uppercase text-slate-400"
                  >
                    Status
                  </label>
                  <select
                    id={`status-${issue.id}`}
                    value={draft.status}
                    onChange={(e) =>
                      updateDraft(issue, { status: e.target.value as IssueStatus })
                    }
                    className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white ${FOCUS_RING}`}
                  >
                    {ISSUE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`priority-${issue.id}`}
                    className="mb-1 block text-[11px] font-semibold uppercase text-slate-400"
                  >
                    Priority
                  </label>
                  <select
                    id={`priority-${issue.id}`}
                    value={draft.priority}
                    onChange={(e) =>
                      updateDraft(issue, { priority: e.target.value as IssuePriority })
                    }
                    className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white ${FOCUS_RING}`}
                  >
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor={`dept-${issue.id}`}
                    className="mb-1 block text-[11px] font-semibold uppercase text-slate-400"
                  >
                    Assigned Department
                  </label>
                  <select
                    id={`dept-${issue.id}`}
                    value={draft.recommendedDepartment}
                    onChange={(e) =>
                      updateDraft(issue, {
                        recommendedDepartment: e.target.value as MunicipalDepartment,
                      })
                    }
                    className={`w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white ${FOCUS_RING}`}
                  >
                    {MUNICIPAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor={`note-${issue.id}`} className="sr-only">
                  Official admin update note for {issue.id}
                </label>
                <input
                  id={`note-${issue.id}`}
                  type="text"
                  maxLength={500}
                  value={draft.adminNote}
                  onChange={(e) => updateDraft(issue, { adminNote: e.target.value })}
                  placeholder="Add dispatch/resolution note visible to citizen (e.g., PWD Crew #4 dispatched)..."
                  className={`flex-1 rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white placeholder-slate-400 ${FOCUS_RING}`}
                />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSave(issue)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      Update Ticket
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
