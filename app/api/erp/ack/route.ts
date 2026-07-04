import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyBearer } from "@/lib/repos/settings";
import { nowIso } from "@/lib/repos/util";
import { checkRateLimit, clientKey, readJsonLimited, PayloadError } from "@/lib/security";

export const dynamic = "force-dynamic";

// POST /api/erp/ack — supplier/ERP acknowledges a released PO (#7).
// Body: { po_number }  Auth: Bearer <api token>
export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!checkRateLimit(`ack:${clientKey(request)}`, 60, 60)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }
  let body: any;
  try {
    body = await readJsonLimited(request);
  } catch (e) {
    if (e instanceof PayloadError)
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const poNumber = String(body.po_number || "").trim();
  if (!poNumber) return NextResponse.json({ ok: false, error: "Field 'po_number' required." }, { status: 400 });

  const db = getDb();
  const po = db.prepare("SELECT id, spot_buy_id, status FROM purchase_orders WHERE po_number=?").get(poNumber) as
    | { id: number; spot_buy_id: number; status: string }
    | undefined;
  if (!po) return NextResponse.json({ ok: false, error: "PO not found." }, { status: 404 });

  const now = nowIso();
  db.prepare("UPDATE purchase_orders SET status='acknowledged', acknowledged_at=? WHERE id=? AND status IN ('released','drafted')").run(now, po.id);
  // Append to the hash-chained audit ledger via a raw insert helper.
  const prev = db.prepare("SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1").get() as { hash: string | null } | undefined;
  const { auditHash } = await import("@/lib/reserve/audit");
  const fields = { spot_buy_id: po.spot_buy_id, actor: "system" as const, actor_person_id: null, stage: "po", action: "PO acknowledged", detail: `${poNumber} acknowledged by supplier/ERP`, created_at: now };
  const hash = auditHash(prev?.hash ?? null, fields);
  db.prepare(
    "INSERT INTO audit_events (spot_buy_id,actor,actor_person_id,stage,action,detail,prev_hash,hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(po.spot_buy_id, "system", null, "po", "PO acknowledged", fields.detail, prev?.hash ?? null, hash, now);

  return NextResponse.json({ ok: true, po_number: poNumber, status: "acknowledged" });
}
