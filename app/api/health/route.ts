import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuditChain } from "@/lib/repos/reserve";
import { SECURITY_HEADERS } from "@/lib/security";

export const dynamic = "force-dynamic";

// Readiness/liveness probe (#4). Returns 503 if the DB is unreachable or the
// audit ledger fails integrity — so an orchestrator can pull a bad instance.
export function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    const audit = verifyAuditChain();
    const body = {
      ok: audit.ok,
      db: "up",
      audit_integrity: audit.ok ? "verified" : `broken@${audit.brokenAtId}`,
      audit_events: audit.count,
      uptime_s: Math.round(process.uptime()),
    };
    return NextResponse.json(body, { status: audit.ok ? 200 : 503, headers: SECURITY_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "down", error: e instanceof Error ? e.message : "error" },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }
}
