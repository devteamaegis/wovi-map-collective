"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ClipboardPaste } from "lucide-react";
import { parseQuoteAction, addQuoteAction } from "@/app/reserve/actions";

// Paste a raw supplier quote (email/PDF text) → AI/heuristic parse → editable
// fields → add to the comparison. "AI drafts, human confirms" (#3).
export function QuotePaster({
  spotBuyId,
  suppliers,
}: {
  spotBuyId: number;
  suppliers: { org_id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [supplier, setSupplier] = useState<number | "">(suppliers[0]?.org_id ?? "");
  const [source, setSource] = useState<string | null>(null);
  const [f, setF] = useState({
    unit_price: "", quantity: "", lead_time_days: "", freight_cost: "", moq: "", incoterm: "", currency: "USD",
  });

  const parse = () =>
    start(async () => {
      const r = await parseQuoteAction(text);
      setSource(r.source);
      setF({
        unit_price: r.unit_price?.toString() ?? "",
        quantity: r.quantity?.toString() ?? "",
        lead_time_days: r.lead_time_days?.toString() ?? "",
        freight_cost: r.freight_cost?.toString() ?? "",
        moq: r.moq?.toString() ?? "",
        incoterm: r.incoterm ?? "",
        currency: r.currency ?? "USD",
      });
    });

  const add = () =>
    start(async () => {
      if (supplier === "") return;
      await addQuoteAction({
        spot_buy_id: spotBuyId,
        supplier_org_id: Number(supplier),
        unit_price: Number(f.unit_price) || 0,
        quantity: Number(f.quantity) || 0,
        lead_time_days: Number(f.lead_time_days) || 0,
        freight_cost: Number(f.freight_cost) || 0,
        moq: f.moq === "" ? null : Number(f.moq),
        incoterm: f.incoterm || null,
        currency: f.currency || "USD",
        source_format: "email",
      });
      setOpen(false);
      setText("");
      setSource(null);
      router.refresh();
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-sm mt-2">
        <ClipboardPaste size={14} /> Paste a quote
      </button>
    );
  }

  const field = (key: keyof typeof f, label: string, ph = "") => (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-wide text-ink-3">{label}</span>
      <input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} placeholder={ph} className="field mt-1 w-full" />
    </label>
  );

  return (
    <div className="mt-3 rounded-lg border border-rule px-3 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Paste the supplier's email or quote text here — e.g. 'Unit price $1.12/kg, 60,000 kg, lead time 7 days, air freight $26,000, DAP'"
        className="field w-full resize-y font-mono text-[12px] leading-relaxed"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={parse} disabled={pending || !text.trim()} className="btn btn-sm">
          <Sparkles size={13} /> {pending ? "Parsing…" : "Parse"}
        </button>
        {source ? (
          <span className="text-[11px] text-ink-3">Parsed by {source === "ai" ? "AI model" : "heuristic parser"} — review below.</span>
        ) : null}
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm ml-auto">Cancel</button>
      </div>
      {source ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {field("unit_price", "Unit price")}
            {field("quantity", "Quantity")}
            {field("lead_time_days", "Lead days")}
            {field("freight_cost", "Freight")}
            {field("moq", "MOQ")}
            {field("incoterm", "Incoterm", "DAP")}
            {field("currency", "Currency", "USD")}
            <label className="block">
              <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Supplier</span>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value ? Number(e.target.value) : "")} className="field mt-1 w-full">
                {suppliers.map((s) => (
                  <option key={s.org_id} value={s.org_id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          <button onClick={add} disabled={pending || supplier === ""} className="btn btn-primary btn-sm mt-3">
            Add to comparison
          </button>
        </>
      ) : null}
    </div>
  );
}
