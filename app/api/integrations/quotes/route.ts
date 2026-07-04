import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyBearer } from "@/lib/repos/settings";
import { addQuote } from "@/lib/repos/reserve";
import { nowIso } from "@/lib/repos/util";
import { checkRateLimit, clientKey, readJsonLimited, PayloadError } from "@/lib/security";

export const dynamic = "force-dynamic";

// Resolve a supplier org by name, creating it if needed so a quote from a
// not-yet-catalogued supplier still lands.
function resolveSupplierOrg(name: string | undefined): number | null {
  if (!name) return null;
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM organizations WHERE lower(name)=lower(?)")
    .get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
       VALUES (?,'supplier',NULL,NULL,'[]','[]','Created from quote webhook',?)`
    )
    .run(name, nowIso());
  return Number(info.lastInsertRowid);
}

/**
 * POST /api/integrations/quotes
 * Inbound supplier-quote ingestion (parsed reply from email/EDI/portal).
 * Auth: Authorization: Bearer <api token>.
 */
export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — send 'Authorization: Bearer <token>'." },
      { status: 401 }
    );
  }
  if (!checkRateLimit(`quotes:${clientKey(request)}`, 60, 60)) {
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

  const db = getDb();
  // Locate the spot buy by ref ("SB-1041") or numeric id.
  let spotBuyId: number | null = null;
  if (body.spot_buy_ref) {
    const row = db
      .prepare("SELECT id FROM spot_buys WHERE lower(ref)=lower(?)")
      .get(String(body.spot_buy_ref)) as { id: number } | undefined;
    spotBuyId = row?.id ?? null;
  } else if (body.spot_buy_id) {
    const row = db
      .prepare("SELECT id FROM spot_buys WHERE id=?")
      .get(Number(body.spot_buy_id)) as { id: number } | undefined;
    spotBuyId = row?.id ?? null;
  }
  if (!spotBuyId) {
    return NextResponse.json(
      { ok: false, error: "Spot buy not found — pass 'spot_buy_ref' (e.g. \"SB-1041\") or 'spot_buy_id'." },
      { status: 404 }
    );
  }

  const supplierOrgId = resolveSupplierOrg(body.supplier);
  if (!supplierOrgId) {
    return NextResponse.json(
      { ok: false, error: "Field 'supplier' (name) is required." },
      { status: 400 }
    );
  }
  const unitPrice = Number(body.unit_price);
  const quantity = Number(body.quantity);
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) {
    return NextResponse.json(
      { ok: false, error: "Fields 'unit_price' and 'quantity' must be numbers." },
      { status: 400 }
    );
  }

  const id = addQuote({
    spot_buy_id: spotBuyId,
    supplier_org_id: supplierOrgId,
    unit_price: unitPrice,
    quantity,
    lead_time_days: Number(body.lead_time_days) || 0,
    moq: body.moq != null ? Number(body.moq) : null,
    freight_cost: Number(body.freight_cost) || 0,
    freight_mode: body.freight_mode ?? null,
    incoterm: body.incoterm ?? null,
    source_format: body.source_format ?? "email",
    notes: body.notes ?? null,
    currency: body.currency ?? "USD",
  });

  return NextResponse.json(
    { ok: true, quote_id: id, spot_buy_id: spotBuyId, url: `/reserve/${spotBuyId}` },
    { status: 201 }
  );
}
