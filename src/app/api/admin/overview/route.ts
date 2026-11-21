import { NextResponse } from "next/server";
import { computeIssueStats, listIssues } from "@/lib/issue-store";
import { extractRequestActor } from "@/lib/portal-store";

export async function GET(req: Request) {
  const actor = extractRequestActor(req);
  if (actor.role !== "admin" && actor.role !== "authority") {
    return NextResponse.json(
      { error: "Forbidden: admin or authority role required." },
      { status: 403 }
    );
  }

  const issues = listIssues();
  const stats = computeIssueStats(issues);

  const kpis = {
    reports: issues.reduce((acc, i) => acc + (i.supportingReportCount ?? 1), 0),
    unique: stats.total,
    open: stats.reported + stats.inProgress,
    critical: issues.filter((i) => i.priority === "Critical").length,
    inProgress: stats.inProgress,
    resolved: stats.resolved,
  };

  const deptMap = new Map<string, { open: number; resolved: number }>();
  for (const issue of issues) {
    const deptName = issue.recommendedDepartment.split("—")[0].trim().slice(0, 26);
    const entry = deptMap.get(deptName) ?? { open: 0, resolved: 0 };
    if (
      issue.status === "Resolved" ||
      issue.status === "Citizen Verified" ||
      issue.status === "Closed"
    ) {
      entry.resolved += 1;
    } else {
      entry.open += 1;
    }
    deptMap.set(deptName, entry);
  }

  const workload = Array.from(deptMap.entries()).map(([department, counts]) => ({
    department,
    open: counts.open,
    resolved: counts.resolved,
  }));

  return NextResponse.json({ kpis, workload });
}
