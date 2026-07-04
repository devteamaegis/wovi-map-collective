import "server-only";
import { getDb } from "./db";

// Fixed-window rate limiter backed by the rate_limits table (#5). Returns false
// when the caller has exceeded `limit` requests in the current window.
export function checkRateLimit(bucket: string, limit: number, windowSec = 60): boolean {
  const db = getDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSec);
  db.prepare(
    `INSERT INTO rate_limits (bucket,window_start,count) VALUES (?,?,1)
     ON CONFLICT(bucket,window_start) DO UPDATE SET count = count + 1`
  ).run(bucket, windowStart);
  const row = db
    .prepare("SELECT count FROM rate_limits WHERE bucket=? AND window_start=?")
    .get(bucket, windowStart) as { count: number } | undefined;
  // Opportunistic cleanup of old windows.
  db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(windowStart - windowSec * 10);
  return (row?.count ?? 1) <= limit;
}

// Best-effort client identifier for rate-limit bucketing.
export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

const MAX_BODY_BYTES = 256 * 1024; // 256 KB cap on inbound JSON payloads

// Read a request body as JSON with a hard size cap. Throws on oversize/invalid.
export async function readJsonLimited<T = any>(req: Request): Promise<T> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len && len > MAX_BODY_BYTES) throw new PayloadError("Payload too large");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new PayloadError("Payload too large");
  return JSON.parse(text) as T;
}

export class PayloadError extends Error {}

// Standard security headers for API responses.
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
