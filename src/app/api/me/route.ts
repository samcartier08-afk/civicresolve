import { NextResponse } from "next/server";
import { extractRequestActor } from "@/lib/portal-store";

export async function GET(req: Request) {
  const actor = extractRequestActor(req);
  return NextResponse.json({
    role: actor.role,
    name: actor.name,
  });
}
