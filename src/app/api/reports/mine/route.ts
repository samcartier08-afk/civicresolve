import { NextResponse } from "next/server";
import { extractRequestActor, getMyReportsForUid } from "@/lib/portal-store";

export async function GET(req: Request) {
  const actor = extractRequestActor(req);
  const { searchParams } = new URL(req.url);
  const cursor = Number(searchParams.get("cursor") || "0");
  const pageSize = 20;

  const allMine = getMyReportsForUid(actor.uid);
  const slice = allMine.slice(cursor, cursor + pageSize);
  const nextCursor = cursor + pageSize < allMine.length ? String(cursor + pageSize) : null;

  return NextResponse.json({
    items: slice,
    nextCursor,
  });
}
