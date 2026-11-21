import { NextResponse } from "next/server";
import { authenticateStaffKey } from "@/lib/staff-auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/security";

export async function POST(req: Request) {
  const rate = checkRateLimit(`staff-login:${getClientIdentifier(req)}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await req.json()) as { accessKey?: string };
    const result = authenticateStaffKey(String(body?.accessKey || ""));
    if (!result) {
      return NextResponse.json(
        { error: "Invalid portal access key." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      token: result.token,
      account: result.account,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
