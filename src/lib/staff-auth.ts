import crypto from "node:crypto";

export interface StaffAccount {
  uid: string;
  role: "authority" | "admin";
  name: string;
  email: string;
  department?: string;
}

const DEPT_PORTAL_KEY = process.env.DEPARTMENT_PORTAL_KEY?.trim() || "DEPT-CIVIC-2026";
const ADMIN_PORTAL_KEY = process.env.ADMIN_PORTAL_KEY?.trim() || "ADMIN-CIVIC-2026";
const SIGNING_SECRET =
  process.env.STAFF_SESSION_SECRET?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  "civicresolve-staff-session-secret-2026";

const DEMO_ACCOUNTS: Record<"authority" | "admin", StaffAccount> = {
  authority: {
    uid: "staff-dept-001",
    role: "authority",
    name: "Department Officer (Demo)",
    email: "dept.officer@civicresolve.in",
    department: "Greater Chennai Corporation (GCC) — Storm Water Drain & Roads",
  },
  admin: {
    uid: "staff-admin-001",
    role: "admin",
    name: "Municipal Admin (Demo)",
    email: "admin@civicresolve.in",
  },
};

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a portal-specific access key and returns the matching demo staff account
 * plus an HMAC-signed session token.
 */
export function authenticateStaffKey(accessKey: string): {
  account: StaffAccount;
  token: string;
} | null {
  const trimmed = accessKey.trim();
  if (!trimmed) return null;

  let account: StaffAccount | null = null;
  if (timingSafeEquals(trimmed, ADMIN_PORTAL_KEY)) {
    account = DEMO_ACCOUNTS.admin;
  } else if (timingSafeEquals(trimmed, DEPT_PORTAL_KEY)) {
    account = DEMO_ACCOUNTS.authority;
  }

  if (!account) return null;

  const payload = Buffer.from(
    JSON.stringify({
      uid: account.uid,
      role: account.role,
      name: account.name,
      email: account.email,
      exp: Date.now() + 12 * 3_600_000,
    })
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("base64url");

  return { account, token: `${payload}.${sig}` };
}

export function verifyStaffToken(token: string | null | undefined): StaffAccount | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("base64url");

  if (!timingSafeEquals(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as StaffAccount & { exp?: number };
    if (parsed.exp && Date.now() > parsed.exp) return null;
    if (parsed.role !== "authority" && parsed.role !== "admin") return null;
    return {
      uid: parsed.uid,
      role: parsed.role,
      name: parsed.name,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}
