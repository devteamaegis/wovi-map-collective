import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { processDueJobs } from "@/lib/repos/reserve";
import { deliverPendingEmails } from "@/lib/repos/settings";
import { SECURITY_HEADERS } from "@/lib/security";

export const dynamic = "force-dynamic";

// Constant-time equality for secrets.
function timingEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Scheduled-job runner (#6). Point a cron (Vercel Cron, GitHub Actions, or an OS
// crontab hitting curl) at this every few minutes. Protected by CRON_SECRET when
// set: send it as `Authorization: Bearer <secret>` (preferred) or `?key=<secret>`.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Unset → open in dev/demo, but fail-closed in production so a missing secret
  // can't leave the job runner world-triggerable.
  if (!secret) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization") ?? "";
  const key = url.searchParams.get("key") ?? "";
  return timingEqual(bearer, `Bearer ${secret}`) || timingEqual(key, secret);
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: SECURITY_HEADERS });
  }
  const jobs = processDueJobs();
  const email = await deliverPendingEmails();
  return NextResponse.json({ ok: true, jobs, email }, { headers: SECURITY_HEADERS });
}

export const GET = run;
export const POST = run;
