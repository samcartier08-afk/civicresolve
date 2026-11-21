import { NextResponse } from "next/server";
import { listIssues } from "@/lib/issue-store";
import { issueToIncidentDetail } from "@/lib/portal-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = Number(searchParams.get("cursor") || "0");
  const pageSize = 25;

  const all = listIssues().map(issueToIncidentDetail);
  const items = all.slice(cursor, cursor + pageSize);
  const nextCursor = cursor + pageSize < all.length ? String(cursor + pageSize) : null;

  return NextResponse.json({
    items,
    nextCursor,
  });
}
