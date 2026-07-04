import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { poToCxml, poToEdi850, type PoDoc } from "@/lib/erp/formats";

export const dynamic = "force-dynamic";

// GET /api/reserve/po/[id]/export?format=csv|json|cxml|edi850
// Downloads the drafted/released PO in an ERP-import-ready shape (#7).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";

  const db = getDb();
  const po = db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(id) as any;
  if (!po) {
    return NextResponse.json({ ok: false, error: "PO not found." }, { status: 404 });
  }
  const lines = db
    .prepare("SELECT * FROM po_lines WHERE po_id=? ORDER BY line_no")
    .all(id) as any[];
  const sb = db
    .prepare("SELECT * FROM spot_buys WHERE id=?")
    .get(po.spot_buy_id) as any;
  const supplier = po.supplier_org_id
    ? (db
        .prepare("SELECT name,country FROM organizations WHERE id=?")
        .get(po.supplier_org_id) as any)
    : null;
  const buyer = sb?.buyer_org_id
    ? (db
        .prepare("SELECT name FROM organizations WHERE id=?")
        .get(sb.buyer_org_id) as any)
    : null;

  if (format === "json") {
    const doc = {
      po_number: po.po_number,
      status: po.status,
      currency: po.currency,
      total_value: po.total_value,
      incoterm: po.incoterm,
      drafted_at: po.drafted_at,
      released_at: po.released_at,
      buyer: buyer?.name ?? null,
      supplier: supplier ? { name: supplier.name, country: supplier.country } : null,
      spot_buy: sb
        ? {
            ref: sb.ref,
            title: sb.title,
            plant: sb.plant,
            cost_center: sb.cost_center,
            material_number: sb.material_number,
          }
        : null,
      lines: lines.map((l) => ({
        line_no: l.line_no,
        description: l.description,
        quantity: l.quantity,
        uom: l.uom,
        unit_price: l.unit_price,
        amount: l.amount,
      })),
    };
    return new NextResponse(JSON.stringify(doc, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${po.po_number}.json"`,
      },
    });
  }

  // Structured interchange formats for direct ERP push (#7).
  if (format === "cxml" || format === "edi850") {
    const doc: PoDoc = {
      po_number: po.po_number,
      currency: po.currency,
      total_value: po.total_value,
      incoterm: po.incoterm,
      released_at: po.released_at,
      buyer: buyer?.name ?? null,
      supplier: supplier?.name ?? null,
      supplier_country: supplier?.country ?? null,
      plant: sb?.plant ?? null,
      cost_center: sb?.cost_center ?? null,
      lines: lines.map((l) => ({
        line_no: l.line_no,
        material_number: sb?.material_number ?? null,
        description: l.description,
        quantity: l.quantity,
        uom: l.uom,
        unit_price: l.unit_price,
        amount: l.amount,
      })),
    };
    if (format === "cxml") {
      return new NextResponse(poToCxml(doc), {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="${po.po_number}.cxml.xml"`,
        },
      });
    }
    return new NextResponse(poToEdi850(doc), {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${po.po_number}.edi"`,
      },
    });
  }

  // CSV — header block then line items, quoting fields that need it.
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: string[] = [];
  rows.push("po_number,supplier,buyer,plant,cost_center,currency,incoterm,total_value,status,released_at");
  rows.push(
    [
      po.po_number,
      supplier?.name ?? "",
      buyer?.name ?? "",
      sb?.plant ?? "",
      sb?.cost_center ?? "",
      po.currency,
      po.incoterm ?? "",
      po.total_value,
      po.status,
      po.released_at ?? "",
    ]
      .map(esc)
      .join(",")
  );
  rows.push("");
  rows.push("line_no,material_number,description,quantity,uom,unit_price,amount");
  for (const l of lines) {
    rows.push(
      [l.line_no, sb?.material_number ?? "", l.description, l.quantity, l.uom ?? "", l.unit_price, l.amount]
        .map(esc)
        .join(",")
    );
  }
  return new NextResponse(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${po.po_number}.csv"`,
    },
  });
}
