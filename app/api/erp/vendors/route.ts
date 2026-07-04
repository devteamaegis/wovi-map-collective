import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyBearer, importVendorsCsv } from "@/lib/repos/settings";
import { checkRateLimit, clientKey, readJsonLimited, PayloadError } from "@/lib/security";
import { safeArray } from "@/lib/repos/util";

export const dynamic = "force-dynamic";

// GET /api/erp/vendors — outbound vendor-master export for an ERP to pull (#7).
// POST /api/erp/vendors — inbound vendor sync (JSON array of vendors).
// Auth: Bearer <api token>.

export async function GET(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const db = getDb();
  const suppliers = db.prepare("SELECT * FROM organizations WHERE kind='supplier' ORDER BY name").all() as any[];
  const vendors = suppliers.map((s) => {
    const contact = db.prepare("SELECT name,email FROM people WHERE org_id=? LIMIT 1").get(s.id) as { name: string; email: string | null } | undefined;
    return {
      name: s.name,
      country: s.country,
      region: s.region,
      materials: safeArray(s.materials),
      capabilities: safeArray(s.capabilities),
      contact_name: contact?.name ?? null,
      contact_email: contact?.email ?? null,
    };
  });
  return NextResponse.json({ ok: true, count: vendors.length, vendors });
}

export async function POST(request: Request) {
  if (!verifyBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!checkRateLimit(`vendorsync:${clientKey(request)}`, 30, 60)) {
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

  const vendors: any[] = Array.isArray(body) ? body : Array.isArray(body.vendors) ? body.vendors : [];
  if (!vendors.length) return NextResponse.json({ ok: false, error: "Expected a 'vendors' array." }, { status: 400 });

  // Reuse the CSV upsert path by projecting JSON → CSV rows.
  const header = "name,country,region,materials,capabilities,contact_name,contact_email";
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = vendors.map((v) =>
    [
      v.name,
      v.country ?? "",
      v.region ?? "",
      Array.isArray(v.materials) ? v.materials.join(";") : v.materials ?? "",
      Array.isArray(v.capabilities) ? v.capabilities.join(";") : v.capabilities ?? "",
      v.contact_name ?? "",
      v.contact_email ?? "",
    ]
      .map(esc)
      .join(",")
  );
  const result = importVendorsCsv([header, ...rows].join("\n"));
  return NextResponse.json({ ok: true, ...result });
}
