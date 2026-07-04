import "server-only";
import crypto from "node:crypto";
import { getSetting, setSetting } from "../repos/settings";

// HMAC-signed, expiring tokens for one-tap mobile approval links (#10). The link
// carries no secret; the signature is verified server-side and the approval can
// only be acted on while still 'pending' (natural single-use).

function secret(): string {
  let s = process.env.WOVI_SECRET || getSetting("approval_secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("approval_secret", s);
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface ApprovalTokenPayload {
  a: number; // approval id
  d: "approved" | "rejected";
  exp: number; // epoch seconds
}

const TTL_SECONDS = 72 * 3600;

export function signApprovalToken(
  approvalId: number,
  decision: "approved" | "rejected",
  nowMs = Date.now()
): string {
  const payload: ApprovalTokenPayload = {
    a: approvalId,
    d: decision,
    exp: Math.floor(nowMs / 1000) + TTL_SECONDS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyApprovalToken(
  token: string,
  nowMs = Date.now()
): ApprovalTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as ApprovalTokenPayload;
    if (payload.exp * 1000 < nowMs) return null;
    if (payload.d !== "approved" && payload.d !== "rejected") return null;
    return payload;
  } catch {
    return null;
  }
}

// Absolute base URL for building links in emails/notifications.
export function appBaseUrl(): string {
  return (
    process.env.WOVI_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3120"
  ).replace(/\/$/, "");
}
