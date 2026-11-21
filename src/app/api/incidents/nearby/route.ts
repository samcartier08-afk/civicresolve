import { NextResponse } from "next/server";
import { haversineDistanceMeters } from "@/lib/igmer-engine";
import { listIssues } from "@/lib/issue-store";
import { issueToNearbyRow } from "@/lib/portal-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius = Number(searchParams.get("radius") || "1000");

  const all = listIssues();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const mapped = all
    .map((issue) => {
      const dist = hasCoords
        ? haversineDistanceMeters(lat, lng, issue.latitude, issue.longitude)
        : 250;
      return issueToNearbyRow(issue, dist);
    })
    .sort((a, b) => a.distanceM - b.distanceM);

  // If user is testing from outside Chennai/Coimbatore, still show closest active incidents cleanly
  const withinRadius = mapped.filter((r) => r.distanceM <= radius);
  const result = withinRadius.length > 0 ? withinRadius : mapped.slice(0, 10);

  return NextResponse.json(result);
}
