"use client";

import "@/lib/i18n-init";
import { useCallback, useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { CitizenShell } from "@/components/layout/CitizenShell";
import { ReportWizard, type ReportInput } from "@/views/citizen/ReportWizard";
import { IncidentQueue, type IncidentRow } from "@/components/authority/IncidentQueue";
import { AdminOverview, type Kpis } from "@/views/admin/AdminOverview";
import type { DeptWorkload } from "@/components/admin/WorkloadChart";
import type { PriorityKey, StatusKey } from "@/components/ui/StatusPill";
import type { CivicIssue, IssueStats } from "@/lib/civic-schemas";
import { Button } from "@/components/ui/Button";

function toStatusKey(status: string): StatusKey {
  const map: Record<string, StatusKey> = {
    Reported: "reported",
    "AI Analyzed": "ai_analyzed",
    "Matched/Created": "ai_analyzed",
    "Under Review": "under_review",
    "Awaiting Info": "awaiting_info",
    Assigned: "assigned",
    Accepted: "accepted",
    "In Progress": "in_progress",
    Escalated: "escalated",
    Reopened: "reopened",
    Rejected: "rejected",
    Resolved: "resolved",
    "Citizen Verified": "closed",
    Closed: "closed",
    needs_manual_review: "under_review",
  };
  return map[status] ?? "reported";
}

function toPriorityKey(priority: string): PriorityKey {
  const lower = priority.toLowerCase();
  if (lower === "critical" || lower === "high" || lower === "medium" || lower === "low") {
    return lower;
  }
  return "medium";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function CivicResolveRouterApp() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/issues?role=admin");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIssues(data.issues ?? []);
      setStats(data.stats ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmitReport = async (
    data: ReportInput,
    idempotencyKey: string
  ): Promise<{ trackingId: string }> => {
    const mediaUrls = await Promise.all(data.images.map(fileToDataUrl));
    const title = data.description.slice(0, 80).trim();
    const location =
      data.landmark && data.landmark.trim().length > 2
        ? data.landmark.trim()
        : data.lat !== null && data.lng !== null
          ? `GPS (${data.lat.toFixed(5)}, ${data.lng.toFixed(5)})`
          : "Reported Location";

    const res = await fetch("/api/issues", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        title: title.length >= 3 ? title : "Civic issue report",
        description: data.description,
        location,
        latitude: data.lat ?? undefined,
        longitude: data.lng ?? undefined,
        locationConsent: true,
        isAnonymous: data.anonymous,
        userCategory: "Auto",
        mediaUrls,
        imageDataUrl: mediaUrls[0],
      }),
    });

    if (!res.ok) throw new Error("Submit failed");
    const json = await res.json();
    await loadData();
    return { trackingId: json.issue.id };
  };

  const rows: IncidentRow[] = issues.map((issue) => ({
    id: issue.id,
    number: issue.id,
    title: issue.title,
    status: toStatusKey(issue.status),
    priority: toPriorityKey(issue.priority),
    department: issue.recommendedDepartment,
    reportCount: issue.supportingReportCount ?? 1,
    ageHours: Math.max(
      1,
      Math.round((Date.now() - new Date(issue.createdAt).getTime()) / 3_600_000)
    ),
    ward: issue.wardCode,
  }));

  const kpis: Kpis | undefined = stats
    ? {
        reports: issues.reduce((acc, i) => acc + (i.supportingReportCount ?? 1), 0),
        unique: stats.total,
        open: stats.reported + stats.inProgress,
        critical: issues.filter((i) => i.priority === "Critical").length,
        inProgress: stats.inProgress,
        resolved: stats.resolved,
      }
    : undefined;

  const deptMap = new Map<string, { open: number; resolved: number }>();
  for (const issue of issues) {
    const key = issue.recommendedDepartment.split("—")[0].trim().slice(0, 22);
    const entry = deptMap.get(key) ?? { open: 0, resolved: 0 };
    if (
      issue.status === "Resolved" ||
      issue.status === "Citizen Verified" ||
      issue.status === "Closed"
    ) {
      entry.resolved += 1;
    } else {
      entry.open += 1;
    }
    deptMap.set(key, entry);
  }
  const workload: DeptWorkload[] = Array.from(deptMap.entries()).map(
    ([department, counts]) => ({ department, ...counts })
  );

  return (
    <Routes>
      <Route element={<CitizenShell />}>
        <Route
          path="/"
          element={
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">CivicResolve</h1>
                <Button onClick={() => navigate("/report")}>Report a problem</Button>
              </div>
              <IncidentQueue
                incidents={rows}
                loading={loading}
                error={error}
                onRetry={loadData}
                onOpen={() => navigate("/my-reports")}
              />
            </div>
          }
        />
        <Route
          path="/report"
          element={<ReportWizard onSubmit={handleSubmitReport} />}
        />
        <Route
          path="/nearby"
          element={
            <IncidentQueue
              incidents={rows}
              loading={loading}
              error={error}
              onRetry={loadData}
              onOpen={() => navigate("/my-reports")}
            />
          }
        />
        <Route
          path="/my-reports"
          element={
            <IncidentQueue
              incidents={rows}
              loading={loading}
              error={error}
              onRetry={loadData}
              onOpen={() => navigate("/profile")}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <AdminOverview
              kpis={kpis}
              workload={workload}
              loading={loading}
              error={error}
              onRetry={loadData}
            />
          }
        />
      </Route>
    </Routes>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <MemoryRouter initialEntries={["/report"]}>
      <CivicResolveRouterApp />
    </MemoryRouter>
  );
}
