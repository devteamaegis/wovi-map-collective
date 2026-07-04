import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyBearer } from "@/lib/repos/settings";
import { addQuote } from "@/lib/repos/reserve";
import { parseQuoteText } from "@/lib/repos/quote-ai";
import { toUsd } from "@/lib/repos/fx";
import { checkRateLimit, clientKey, readJsonLimited, PayloadError } from "@/lib/security";

export const dynamic = "force-dynamic";

// Inbound-email webhook (#2). A mail provider's inbound-parse (Postmark, SendGrid,
// Mailgun) POSTs a supplier reply here; we parse it into a structured quote and
// attach it to the referenced spot buy. Auth: Bearer <api token>.
// Body: { from, subject, text, spot_buy_ref? }  (ref also sniffed from subject)
export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!checkRateLimit(`inbound:${clientKey(request)}`, 120, 60)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }

  let body: any;
  try {
    body = await readJsonLimited(request);
  } catch (e) {
    if (e instanceof PayloadError)
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const from = String(body.from || "").trim();
  const text = String(body.text || body.body || "");
  const subject = String(body.subject || "");
  const db = getDb();

  // Locate the spot buy by explicit ref or a SB-#### token in the subject/body.
  let ref: string | null = body.spot_buy_ref ? String(body.spot_buy_ref) : null;
  if (!ref) {
    const m = (subject + " " + text).match(/SB-\d{3,}/i);
    ref = m ? m[0].toUpperCase() : null;
  }
  if (!ref) {
    return NextResponse.json({ ok: false, error: "No spot-buy reference (SB-####) found in subject/body." }, { status: 422 });
  }
  const sb = db.prepare("SELECT id FROM spot_buys WHERE lower(ref)=lower(?)").get(ref) as { id: number } | undefined;
  if (!sb) {
    return NextResponse.json({ ok: false, error: `Spot buy ${ref} not found.` }, { status: 404 });
  }

  // Match supplier by sender email, then by domain.
  let supplierOrgId: number | null = null;
  if (from) {
    const person = db.prepare("SELECT org_id FROM people WHERE lower(email)=lower(?)").get(from) as { org_id: number | null } | undefined;
    if (person?.org_id) supplierOrgId = person.org_id;
    if (!supplierOrgId) {
      const domain = from.split("@")[1];
      if (domain) {
        const p2 = db.prepare("SELECT org_id FROM people WHERE email LIKE ? AND org_id IS NOT NULL LIMIT 1").get(`%@${domain}`) as { org_id: number | null } | undefined;
        if (p2?.org_id) supplierOrgId = p2.org_id;
      }
    }
  }
  if (!supplierOrgId) {
    return NextResponse.json({ ok: false, error: `Could not match sender '${from}' to a known supplier.` }, { status: 422 });
  }

  const parsed = await parseQuoteText(text);
  if (parsed.unit_price == null || parsed.quantity == null) {
    return NextResponse.json(
      { ok: false, error: "Could not extract price/quantity from the message.", parsed },
      { status: 422 }
    );
  }

  const quoteId = addQuote({
    spot_buy_id: sb.id,
    supplier_org_id: supplierOrgId,
    unit_price: parsed.unit_price,
    quantity: parsed.quantity,
    lead_time_days: parsed.lead_time_days ?? 0,
    freight_cost: parsed.freight_cost ?? 0,
    moq: parsed.moq,
    incoterm: parsed.incoterm,
    currency: parsed.currency,
    source_format: "email",
    notes: `Auto-parsed from inbound email (${parsed.source}).`,
  });

  return NextResponse.json(
    { ok: true, quote_id: quoteId, spot_buy_ref: ref, parsed_by: parsed.source, landed_usd: toUsd(parsed.unit_price * parsed.quantity + (parsed.freight_cost ?? 0), parsed.currency) },
    { status: 201 }
  );
}
