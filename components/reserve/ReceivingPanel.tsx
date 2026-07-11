"use client";

import { useEffect, useState } from "react";
import { PackageCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge, type Tone } from "@/components/Badge";
import { fmtMoney, MATCH_LABEL, type MatchStatus } from "@/lib/reserve/logic";
import { recordReceiptAction, reconcileReceiptAction } from "@/app/reserve/actions";

const MATCH_TONE: Record<string, Tone> = {
  matched: "good",
  pending: "neutral",
  qty_variance: "warn",
  price_variance: "warn",
  both_variance: "danger",
};

export function ReceivingPanel({
  spotBuyId,
  receipts,
  orderedQty,
  uom,
  poAmount,
  currency,
  closed = false,
  onRun,
  pending,
}: {
  spotBuyId: number;
  receipts: any[];
  orderedQty: number;
  uom: string | null;
  poAmount: number;
  currency: string;
  closed?: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
  pending: boolean;
}) {
  const received = receipts.reduce((s, r) => s + (r.quantity_received || 0), 0);
  const remaining = Math.max(0, orderedQty - received);
  const [qty, setQty] = useState(remaining || orderedQty);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmt, setInvoiceAmt] = useState<string>(String(poAmount || ""));
  const [partial, setPartial] = useState(false);
  const [reconcileNote, setReconcileNote] = useState("");
  const lastReceipt = receipts[receipts.length - 1];
  const hasVariance =
    !!lastReceipt &&
    ["qty_variance", "price_variance", "both_variance"].includes(lastReceipt.match_status);

  // After router.refresh() (this panel stays mounted), re-seed the qty field to
  // what's still outstanding so a prior partial shipment doesn't leave a stale
  // (too-large) prefill.
  useEffect(() => {
    setQty(remaining || orderedQty);
  }, [remaining, orderedQty]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">
        Record the delivery and the supplier invoice. Reserve runs the{" "}
        <strong>3-way match</strong> (PO ↔ receipt ↔ invoice); a clean match closes the buy.
      </p>

      {receipts.length > 0 ? (
        <ul className="space-y-1.5">
          {receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2 text-[13px]">
              <span className="text-ink">
                {r.quantity_received}{uom ? " " + uom : ""} received
                {r.partial ? " (partial)" : ""}
                {r.invoice_number ? ` · inv ${r.invoice_number}` : ""}
              </span>
              <Badge tone={MATCH_TONE[r.match_status] ?? "neutral"}>
                {MATCH_LABEL[r.match_status as MatchStatus] ?? r.match_status}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {hasVariance && !closed ? (
        <div className="rounded-lg border border-[#e6c9a0] bg-[#fbf3e9] px-3 py-3">
          <div className="flex items-center gap-2 text-warn-text">
            <AlertTriangle size={15} />
            <span className="text-[13px] font-medium">3-way match variance — needs a decision</span>
          </div>
          <p className="mt-1 text-[12px] text-ink-2">
            Accept the variance (over/under-shipment or a price outside tolerance) and close the
            buy, leaving a note on the audit trail.
          </p>
          <textarea
            value={reconcileNote}
            onChange={(e) => setReconcileNote(e.target.value)}
            rows={2}
            placeholder="Why is this variance acceptable? e.g. 'Supplier confirmed 3% overage, billed at contract price'"
            className="field mt-2 w-full resize-y text-[13px]"
          />
          <button
            onClick={() => onRun(() => reconcileReceiptAction(spotBuyId, reconcileNote || null))}
            disabled={pending}
            className="btn btn-warn btn-sm mt-2"
          >
            <CheckCircle2 size={14} /> Reconcile &amp; close
          </button>
        </div>
      ) : null}

      {closed ? (
        <div className="flex items-center gap-2 rounded-lg border border-rule bg-[#e4efea] px-3 py-2.5 text-[13px] text-good-text">
          <CheckCircle2 size={15} /> This buy is closed — the receiving ledger is final.
        </div>
      ) : (
      <div className="rounded-lg border border-rule px-3 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Qty received</span>
            <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="field mt-1 w-full" />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Invoice #</span>
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="field mt-1 w-full" placeholder="INV-…" />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Invoice amt ({currency})</span>
            <input type="number" value={invoiceAmt} onChange={(e) => setInvoiceAmt(e.target.value)} className="field mt-1 w-full" />
          </label>
          <label className="flex items-end gap-2 pb-1.5">
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
            <span className="text-[12px] text-ink-2">Partial shipment</span>
          </label>
        </div>
        <div className="mt-1.5 text-[11px] text-ink-3">
          Ordered {orderedQty}{uom ? " " + uom : ""} · PO {fmtMoney(poAmount, currency)}
          {received > 0 ? ` · received so far ${received}` : ""}
        </div>
        <button
          onClick={() =>
            onRun(() =>
              recordReceiptAction({
                spot_buy_id: spotBuyId,
                quantity_received: qty,
                invoice_number: invoiceNo || null,
                invoice_amount: invoiceAmt === "" ? null : Number(invoiceAmt),
                partial,
              })
            )
          }
          disabled={pending || qty <= 0}
          className="btn btn-primary btn-sm mt-3"
        >
          <PackageCheck size={14} /> Record receipt & match
        </button>
      </div>
      )}
    </div>
  );
}
