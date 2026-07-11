// ERP-interchange PO formats (#7). Pure builders — no DB — so they're testable
// and reusable by the export route and any push connector.

export interface PoDoc {
  po_number: string;
  currency: string;
  total_value: number;
  incoterm: string | null;
  released_at: string | null;
  buyer: string | null;
  supplier: string | null;
  supplier_country: string | null;
  plant: string | null;
  cost_center: string | null;
  lines: {
    line_no: number;
    material_number: string | null;
    description: string | null;
    quantity: number;
    uom: string | null;
    unit_price: number;
    amount: number;
  }[];
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

// Ariba/Coupa-style cXML OrderRequest (illustrative but well-formed).
export function poToCxml(po: PoDoc): string {
  const items = po.lines
    .map(
      (l) => `      <ItemOut quantity="${l.quantity}" lineNumber="${l.line_no}">
        <ItemID><SupplierPartID>${xmlEscape(l.material_number ?? "N/A")}</SupplierPartID></ItemID>
        <ItemDetail>
          <UnitPrice><Money currency="${xmlEscape(po.currency)}">${l.unit_price}</Money></UnitPrice>
          <Description xml:lang="en">${xmlEscape(l.description ?? "")}</Description>
          <UnitOfMeasure>${xmlEscape(l.uom ?? "EA")}</UnitOfMeasure>
        </ItemDetail>
      </ItemOut>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<cXML payloadID="${xmlEscape(po.po_number)}" timestamp="${po.released_at ?? ""}">
  <Request>
    <OrderRequest>
      <OrderRequestHeader orderID="${xmlEscape(po.po_number)}" type="new">
        <Total><Money currency="${xmlEscape(po.currency)}">${po.total_value}</Money></Total>
        <ShipTo><Address><Name xml:lang="en">${xmlEscape(po.plant ?? po.buyer ?? "")}</Name></Address></ShipTo>
        <Contact role="supplier"><Name xml:lang="en">${xmlEscape(po.supplier ?? "")}</Name></Contact>
        <Comments>Incoterm ${xmlEscape(po.incoterm ?? "")}; cost center ${xmlEscape(po.cost_center ?? "")}</Comments>
      </OrderRequestHeader>
${items}
    </OrderRequest>
  </Request>
</cXML>`;
}

// Strip X12 control characters (element sep *, segment terminator ~, sub-element
// sep :, newlines) from a free-text field so a supplier name / description can't
// corrupt or inject into the segment stream.
function ediField(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v).replace(/[*~:\r\n^]/g, " ").trim();
}

// ANSI X12 EDI 850 Purchase Order (illustrative segment structure).
export function poToEdi850(po: PoDoc, opts?: { date?: string; control?: string }): string {
  const date = (opts?.date ?? po.released_at ?? "").replace(/[^0-9]/g, "").slice(0, 8) || "00000000";
  const ctrl = opts?.control ?? "000000001";
  const seg: string[] = [];
  seg.push(`ST*850*${ctrl}`);
  seg.push(`BEG*00*NE*${ediField(po.po_number)}**${date}`);
  seg.push(`CUR*BY*${ediField(po.currency)}`);
  if (po.incoterm) seg.push(`FOB*${ediField(po.incoterm)}`);
  seg.push(`N1*BY*${ediField(po.buyer)}`);
  seg.push(`N1*SE*${ediField(po.supplier)}*92*${ediField(po.supplier_country)}`);
  po.lines.forEach((l, i) => {
    seg.push(`PO1*${i + 1}*${l.quantity}*${ediField(l.uom) || "EA"}*${l.unit_price}**BP*${ediField(l.material_number) || "N/A"}`);
    if (l.description) seg.push(`PID*F****${ediField(l.description)}`);
  });
  seg.push(`CTT*${po.lines.length}`);
  seg.push(`SE*${seg.length + 1}*${ctrl}`);
  return seg.map((s) => s + "~").join("\n") + "\n";
}
