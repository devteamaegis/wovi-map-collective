"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Layers } from "lucide-react";
import { addLineAction, deleteLineAction } from "@/app/reserve/actions";

// Additional materials on a single spot buy (#11). The header material is line 0;
// these are extra lines that flow onto the PO.
export function LinesEditor({
  spotBuyId,
  lines,
  editable,
}: {
  spotBuyId: number;
  lines: any[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [mn, setMn] = useState("");
  const [qty, setQty] = useState("");
  const [uom, setUom] = useState("");
  const [price, setPrice] = useState("");
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (lines.length === 0 && !editable) return null;

  return (
    <div className="mt-3 rounded-lg border border-rule px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-ink-3" />
        <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Additional lines ({lines.length})</span>
      </div>
      {lines.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-ink">
                {l.material_desc} — {l.quantity}{l.uom ? " " + l.uom : ""}
                {l.unit_price ? <span className="text-ink-3"> @ {fmt(l.unit_price)} = {fmt(l.unit_price * l.quantity)}</span> : null}
                {l.material_number ? <span className="text-ink-3"> · {l.material_number}</span> : null}
              </span>
              {editable ? (
                <button onClick={() => run(() => deleteLineAction(l.id))} disabled={pending} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-danger" aria-label={`Remove line ${l.material_desc}`}>
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Material" placeholder="Material" className="field py-1 text-[12px] sm:col-span-2" />
          <input value={mn} onChange={(e) => setMn(e.target.value)} aria-label="Part number" placeholder="Part #" className="field py-1 text-[12px]" />
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" aria-label="Quantity" placeholder="Qty" className="field py-1 text-[12px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" aria-label="Unit price" placeholder="Unit $" className="field py-1 text-[12px]" />
          <div className="flex gap-1">
            <input value={uom} onChange={(e) => setUom(e.target.value)} aria-label="Unit of measure" placeholder="UoM" className="field py-1 text-[12px] w-full" />
            <button
              onClick={() => run(async () => { if (!desc.trim()) return; await addLineAction(spotBuyId, { material_desc: desc, material_number: mn || null, quantity: Number(qty) || 0, uom: uom || null, unit_price: Number(price) || 0 }); setDesc(""); setMn(""); setQty(""); setUom(""); setPrice(""); })}
              disabled={pending || !desc.trim()}
              className="btn btn-sm shrink-0"
              aria-label="Add line"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
