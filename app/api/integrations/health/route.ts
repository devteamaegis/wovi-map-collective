import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getApiToken, getSetting } from "@/lib/repos/settings";

export const dynamic = "force-dynamic";

// GET /api/integrations/health — unauthenticated connector-status probe for
// monitoring and for external systems to verify Reserve is reachable.
export function GET() {
  const db = getDb();
  const c = (t: string) =>
    (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
  return NextResponse.json({
    ok: true,
    service: "wovi-reserve",
    token_configured: getApiToken() != null,
    slack_configured: getSetting("slack_webhook_url") != null,
    counts: {
      spot_buys: c("spot_buys"),
      suppliers: (
        db
          .prepare("SELECT COUNT(*) c FROM organizations WHERE kind='supplier'")
          .get() as { c: number }
      ).c,
      outbox: c("outbox"),
    },
  });
}
