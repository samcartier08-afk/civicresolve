/**
 * Lightweight in-memory sliding-window rate limiter & error sanitizer
 * for API route protection on Cloud Run / serverless deployments.
 */

type RateLimitEntry = {
  timestamps: number[];
};

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60_000,
  now = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  const entry = store.get(identifier) ?? { timestamps: [] };
  const recent = entry.timestamps.filter((t) => t > cutoff);

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    store.set(identifier, { timestamps: recent });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  recent.push(now);
  store.set(identifier, { timestamps: recent });

  // Prevent unbounded memory growth across many unique IPs
  if (store.size > 1000) {
    for (const [key, val] of store.entries()) {
      if (val.timestamps.every((t) => t <= cutoff)) {
        store.delete(key);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore(): void {
  store.clear();
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "local";
}

export function sanitizeApiError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("GEMINI_API_KEY")) {
    return {
      message:
        "Server API key is not configured. Set GEMINI_API_KEY in Cloud Run environment variables or .env.local.",
      status: 503,
    };
  }
  if (raw.toLowerCase().includes("quota") || raw.includes("429")) {
    return {
      message: "Gemini API rate limit reached. Please wait a few seconds and try again.",
      status: 429,
    };
  }
  return {
    message: "Unable to complete the AI request right now. Please try again.",
    status: 500,
  };
}

/**
 * Neutralizes CSV formula injection (Excel/Sheets cells starting with =, +, -, @)
 * and safely quotes RFC-4180 CSV values.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

