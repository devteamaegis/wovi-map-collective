"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { Badge } from "@/components/Badge";
import { fmtMoney } from "@/lib/reserve/logic";
import {
  recordReceiptAction,
  reconcileReceiptAction,
  recordInvoiceAction,
} from "@/app/reserve/actions";

export function ReceivingPanel({
  spotBuyId,
  receipts,
  invoices = [],
  invoicedTotal = 0,
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
  invoices?: any[];
  invoicedTotal?: number;
  orderedQty: number;
  uom: string | null;
  poAmount: number;
  currency: string;
  closed?: boolean;
  onRun: (fn: () => Promise<unknown>) => void;
  pending: boolean;
}) {
  const router = useRouter();
  const received = receipts.reduce((s, r) => s + (r.quantity_received || 0), 0);
  const remaining = Math.max(0, orderedQty - received);
  const [qty, setQty] = useState(remaining || orderedQty);
  const [partial, setPartial] = useState(false);
  const [reconcileNote, setReconcileNote] = useState("");

  const [invNo, setInvNo] = useState("");
  const [invAmt, setInvAmt] = useState("");
  const [invErr, setInvErr] = useState<string | null>(null);
  const [invPending, startInv] = useTransition();

  // Re-seed the qty field to what's outstanding after a router.refresh().
  useEffect(() => {
    setQty(remaining || orderedQty);
  }, [remaining, orderedQty]);

  const tol = 0.02;
  const fullyReceived = received + 1e-9 >= orderedQty;
  const hasInvoice = invoicedTotal > 0;
  const qtyOff = orderedQty > 0 && Math.abs(received - orderedQty) / orderedQty > tol;
  const priceOff = hasInvoice && poAmount > 0 && Math.abs(invoicedTotal - poAmount) / poAmount > tol;
  const hasVariance = !closed && fullyReceived && hasInvoice && (qtyOff || priceOff);
  const invoiceDelta = invoicedTotal - poAmount;

  const addInvoice = () => {
    setInvErr(null);
    const amt = Number(invAmt);
    const number = invNo.trim();
    if (!number) {
      setInvErr("Enter an invoice number.");
      return;
    }
    if (!(amt > 0)) {
      setInvErr("Enter an invoice amount greater than zero.");
      return;
    }
    if (invoices.some((iv) => (iv.invoice_number || "").toLowerCase() === number.toLowerCase())) {
      setInvErr(`Invoice ${number} is already recorded for this buy.`);
      return;
    }
    startInv(async () => {
      const r = await recordInvoiceAction({ spot_buy_id: spotBuyId, invoice_number: number, amount: amt });
      if (!r.ok) {
        setInvErr(r.error || "Could not record the invoice.");
        return;
      }
      setInvNo("");
      setInvAmt("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">
        Record deliveries and supplier invoices. Reserve runs the{" "}
        <strong>3-way match</strong> — PO ↔ goods received ↔ invoiced — and closes the buy when
        all three line up.
      </p>

      {/* Match summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-rule bg-paper-2 px-3 py-2 text-[12px]">
        <span className="text-ink-2">
          Received <strong className="text-ink">{received}</strong>/{orderedQty}
          {uom ? " " + uom : ""}
        </span>
        <span className="text-ink-2">
          Invoiced <strong className="text-ink">{fmtMoney(invoicedTotal, currency)}</strong> of PO{" "}
          {fmtMoney(poAmount, currency)}
        </span>
        {hasInvoice ? (
          <Badge tone={priceOff ? "warn" : "good"}>
            {priceOff
              ? `${invoiceDelta > 0 ? "+" : ""}${fmtMoney(Math.round(invoiceDelta), currency)} vs PO`
              : "Invoice matches PO"}
          </Badge>
        ) : null}
      </div>

      {/* Goods receipts */}
      {receipts.length > 0 ? (
        <div>
          <p className="mono mb-1 text-[10px] uppercase tracking-wide text-ink-3">Goods receipts</p>
          <ul className="space-y-1.5">
            {receipts.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2 text-[13px]"
              >
                <span className="text-ink">
                  {r.quantity_received}
                  {uom ? " " + uom : ""} received{r.partial ? " (partial)" : ""}
                </span>
                <Badge
                  tone={r.match_status === "matched" ? "good" : r.match_status === "pending" ? "neutral" : "warn"}
                >
                  {r.partial ? "Partial" : r.match_status === "matched" ? "Qty OK" : "Qty variance"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Supplier invoices */}
      <div>
        <p className="mono mb-1 text-[10px] uppercase tracking-wide text-ink-3">Supplier invoices</p>
        {invoices.length > 0 ? (
          <ul className="space-y-1.5">
            {invoices.map((iv) => (
              <li
                key={iv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2 text-[13px]"
              >
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <FileText size={13} className="text-ink-3" /> {iv.invoice_number}
                </span>
                <span className="tabular-nums text-ink-2">
                  {fmtMoney(iv.amount, iv.currency || currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-3">No invoices recorded yet.</p>
        )}

        {!closed ? (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Invoice #</span>
              <input
                value={invNo}
                onChange={(e) => setInvNo(e.target.value)}
                placeholder="INV-…"
                className="field mt-1 w-36"
              />
            </label>
            <label className="block">
              <span className="mono text-[10px] uppercase tracking-wide text-ink-3">
                Amount ({currency})
              </span>
              <input
                type="number"
                value={invAmt}
                onChange={(e) => setInvAmt(e.target.value)}
                placeholder="0"
                className="field mt-1 w-32"
              />
            </label>
            <button onClick={addInvoice} disabled={invPending} className="btn btn-sm">
              <FileText size={14} /> Add invoice
            </button>
          </div>
        ) : null}
        {invErr ? <p className="mt-1.5 text-[12px] text-danger">{invErr}</p> : null}
      </div>

      {/* Variance reconcile */}
      {hasVariance ? (
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

      {/* Record goods receipt */}
      {closed ? (
        <div className="flex items-center gap-2 rounded-lg border border-rule bg-[#e4efea] px-3 py-2.5 text-[13px] text-good-text">
          <CheckCircle2 size={15} /> This buy is closed — the receiving ledger is final.
        </div>
      ) : (
        <div className="rounded-lg border border-rule px-3 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mono text-[10px] uppercase tracking-wide text-ink-3">Qty received</span>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="field mt-1 w-32"
              />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
              <span className="text-[12px] text-ink-2">Partial shipment</span>
            </label>
          </div>
          <div className="mt-1.5 text-[11px] text-ink-3">
            Ordered {orderedQty}
            {uom ? " " + uom : ""}
            {received > 0 ? ` · received so far ${received}` : ""}
          </div>
          <button
            onClick={() =>
              onRun(() => recordReceiptAction({ spot_buy_id: spotBuyId, quantity_received: qty, partial }))
            }
            disabled={pending || qty <= 0}
            className="btn btn-primary btn-sm mt-2"
          >
            <PackageCheck size={14} /> Record goods receipt
          </button>
        </div>
      )}
    </div>
  );
}
