import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyBearer } from "@/lib/repos/settings";
import { createSpotBuy } from "@/lib/repos/reserve";
import { nowIso } from "@/lib/repos/util";
import { checkRateLimit, clientKey, readJsonLimited, PayloadError } from "@/lib/security";
import type { SpotBuyTrigger, Urgency, Metal } from "@/lib/reserve/types";

export const dynamic = "force-dynamic";

const TRIGGERS: SpotBuyTrigger[] = [
  "mrp_exception",
  "quality_rejection",
  "line_down",
  "shortage",
  "volume_change",
  "force_majeure",
];
const URGENCIES: Urgency[] = ["low", "med", "high", "critical"];

// Resolve a buyer org by name, creating it if the external system references one
// Wovi hasn't seen (keeps the webhook usable against an empty database).
function resolveBuyerOrg(name: string | undefined): number | null {
  if (!name) return null;
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM organizations WHERE lower(name)=lower(?)")
    .get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
       VALUES (?,'buyer',NULL,NULL,'[]','[]','Created from trigger webhook',?)`
    )
    .run(name, nowIso());
  return Number(info.lastInsertRowid);
}

/**
 * POST /api/integrations/triggers
 * Inbound urgent-need ingestion for MRP / quality / line-down systems.
 * Auth: Authorization: Bearer <api token from /reserve/integrations>.
 */
export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — generate an API token on /reserve/integrations and send it as 'Authorization: Bearer <token>'." },
      { status: 401 }
    );
  }
  if (!checkRateLimit(`triggers:${clientKey(request)}`, 60, 60)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded (60/min)." }, { status: 429 });
  }

  let body: any;
  try {
    body = await readJsonLimited(request);
  } catch (e) {
    if (e instanceof PayloadError)
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "Field 'title' is required." }, { status: 400 });
  }
  const trigger = TRIGGERS.includes(body.trigger) ? body.trigger : "shortage";
  const urgency = URGENCIES.includes(body.urgency) ? body.urgency : "high";
  const metal: Metal = ["steel", "aluminum"].includes(body.metal) ? body.metal : "none";

  const id = createSpotBuy({
    title,
    material_number: body.material_number ?? null,
    material_desc: body.material_desc ?? null,
    quantity: Number(body.quantity) || 0,
    uom: body.uom ?? null,
    required_by: body.required_by ?? null,
    cost_center: body.cost_center ?? null,
    plant: body.plant ?? null,
    trigger,
    urgency,
    downtime_cost_per_hour: Number(body.downtime_cost_per_hour) || 0,
    buyer_org_id: resolveBuyerOrg(body.buyer_org),
    buyer_person_id: null,
    cross_border: Boolean(body.cross_border),
    metal,
    ship_from_country: body.ship_from_country ?? null,
    ship_to_country: body.ship_to_country ?? null,
    incoterm: body.incoterm ?? null,
    via: String(body.source || "external system"),
  });

  const db = getDb();
  const ref = (db.prepare("SELECT ref FROM spot_buys WHERE id=?").get(id) as { ref: string }).ref;
  return NextResponse.json({ ok: true, id, ref, url: `/reserve/${id}` }, { status: 201 });
}
