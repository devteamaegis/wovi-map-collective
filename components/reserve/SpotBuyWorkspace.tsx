"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  Radio,
  CheckCircle2,
  Circle,
  FileText,
  Stamp,
  ShoppingCart,
  Globe2,
  Clock3,
  PackageCheck,
} from "lucide-react";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import {
  Badge,
  Tone,
} from "@/components/Badge";
import { ApprovalButtons } from "./ApprovalButtons";
import { ReceivingPanel } from "./ReceivingPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { QuotePaster } from "./QuotePaster";
import { LinesEditor } from "./LinesEditor";
import {
  triggerBadge,
  urgencyBadge,
  spotStatusBadge,
  approvalBadge,
  poBadge,
  customsBadge,
  inviteBadge,
  actorBadge,
} from "./badges";
import { fmtMoney } from "@/lib/reserve/logic";
import { PIPELINE } from "@/lib/reserve/types";
import { timeAgo } from "@/lib/format";
import {
  confirmUrgencyAction,
  draftRfqAction,
  updateRfqBodyAction,
  toggleInviteAction,
  approveRfqSendAction,
  followUpInviteAction,
  simulateQuotesAction,
  selectQuoteAction,
  buildRequisitionAction,
  updateRequisitionAction,
  submitRequisitionAction,
  draftPoAction,
  releasePoAction,
  assembleCustomsAction,
  verifyCustomsAction,
  cancelSpotBuyAction,
} from "@/app/reserve/actions";

// Loose structural type for the serialized SpotBuyDetail from the repo.
type Detail = any;

function AiTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#cdddec] bg-accent-pale px-1.5 py-0.5 text-[10px] font-medium text-[#2f4d68]">
      <Sparkles size={11} /> AI-drafted
    </span>
  );
}

function Stage({
  n,
  icon: Icon,
  title,
  state,
  children,
}: {
  n: string;
  icon: typeof Radio;
  title: string;
  state: "done" | "active" | "upcoming";
  children: React.ReactNode;
}) {
  return (
    <Card
      className={`overflow-hidden ${
        state === "active" ? "ring-1 ring-accent-2" : ""
      } ${state === "upcoming" ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2.5 border-b border-rule px-4 py-3 sm:px-5">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-medium ${
            state === "done"
              ? "bg-[#e4efea] text-good"
              : state === "active"
                ? "bg-accent text-white"
                : "bg-paper-2 text-ink-3"
          }`}
        >
          {state === "done" ? <CheckCircle2 size={15} /> : n}
        </span>
        <Icon size={15} className="text-ink-3" />
        <h3 className="font-medium text-ink">{title}</h3>
        {state === "done" ? (
          <span className="ml-auto text-[11px] font-medium text-good">Done</span>
        ) : state === "active" ? (
          <span className="ml-auto text-[11px] font-medium text-accent">
            Action needed
          </span>
        ) : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </Card>
  );
}

export function SpotBuyWorkspace({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const sb = detail.spotBuy;
  const actor: number | null = sb.buyer_person_id;
  const statusIdx = PIPELINE.findIndex((p) => p.key === sb.status);
  const stageState = (key: string): "done" | "active" | "upcoming" => {
    const idx = PIPELINE.findIndex((p) => p.key === key);
    if (sb.status === "cancelled") return idx < statusIdx ? "done" : "upcoming";
    if (idx < statusIdx) return "done";
    if (idx === statusIdx) return "active";
    return "upcoming";
  };

  const rfq = detail.rfq;
  const invites = detail.invites as any[];
  const quotes = detail.quotes as any[];
  const req = detail.requisition;
  const approvals = detail.approvals as any[];
  const po = detail.po;
  const customs = detail.customs;
  const candidates = detail.candidates as any[];
  const selectedQuote = quotes.find((q) => q.selected);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Pipeline column */}
      <div className="space-y-4 lg:col-span-2">
        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PIPELINE.map((p, i) => {
            const st = stageState(p.key);
            return (
              <span key={p.key} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${
                    st === "done"
                      ? "bg-[#e4efea] text-good"
                      : st === "active"
                        ? "bg-navy text-white"
                        : "bg-paper-2 text-ink-3"
                  }`}
                >
                  {st === "done" ? <CheckCircle2 size={12} /> : <Circle size={11} />}
                  {p.label}
                </span>
                {i < PIPELINE.length - 1 ? (
                  <span className="text-ink-3">→</span>
                ) : null}
              </span>
            );
          })}
        </div>

        {/* Stage 1 — Triage */}
        <Stage n="1" icon={Clock3} title="Triage — confirm the urgent need" state={stageState("triage")}>
          {sb.urgency_confirmed ? (
            <p className="text-sm text-ink-2">
              Urgency confirmed — cleared to source. Detection aggregated from the
              {" "}
              {triggerBadge(sb.trigger).label.toLowerCase()} trigger.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-3">
                A human confirms this is genuinely urgent before Reserve acts.
              </p>
              <button
                onClick={() => run(() => confirmUrgencyAction(sb.id, actor))}
                disabled={pending}
                className="btn btn-primary btn-sm"
              >
                Confirm urgency
              </button>
            </div>
          )}
          <LinesEditor
            spotBuyId={sb.id}
            lines={detail.lines ?? []}
            editable={["triage", "sourcing", "quoting"].includes(sb.status)}
          />
        </Stage>

        {/* Stage 2 — Broadcast RFQ */}
        <Stage n="2" icon={Radio} title="Draft & broadcast the RFQ" state={stageState("sourcing")}>
          {!rfq ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-3">
                AI drafts a tailored RFQ and pre-selects the approved supplier base.
              </p>
              <button
                onClick={() => run(() => draftRfqAction(sb.id))}
                disabled={pending || !sb.urgency_confirmed}
                className="btn btn-primary btn-sm"
              >
                <Sparkles size={14} /> Draft RFQ
              </button>
            </div>
          ) : rfq.status === "draft" ? (
            <RfqDraft
              rfq={rfq}
              invites={invites}
              candidates={candidates}
              actor={actor}
              onRun={run}
              pending={pending}
            />
          ) : (
            <RfqSent
              invites={invites}
              spotBuyId={sb.id}
              hasQuotes={quotes.length > 0}
              onRun={run}
              pending={pending}
            />
          )}
        </Stage>

        {/* Stage 3 — Compare quotes */}
        <Stage n="3" icon={FileText} title="Normalize & compare quotes" state={stageState("quoting")}>
          {quotes.length === 0 ? (
            <p className="text-sm text-ink-3">
              Quotes appear here — parsed from PDF, Excel, or email into one
              side-by-side comparison — as suppliers reply.
            </p>
          ) : (
            <QuoteTable
              quotes={quotes}
              actor={actor}
              onRun={run}
              pending={pending}
            />
          )}
          {candidates.length > 0 && sb.status !== "closed" && sb.status !== "cancelled" ? (
            <QuotePaster
              spotBuyId={sb.id}
              suppliers={candidates.map((c: any) => ({ org_id: c.org_id, name: c.name }))}
            />
          ) : null}
        </Stage>

        {/* Stage 4 — Requisition */}
        <Stage n="4" icon={ShoppingCart} title="Pre-fill the requisition" state={stageState("requisition")}>
          {!req ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-3">
                Reserve pre-populates the requisition from the selected quote and
                flags missing fields.
              </p>
              <button
                onClick={() => run(() => buildRequisitionAction(sb.id))}
                disabled={pending || !selectedQuote}
                className="btn btn-primary btn-sm"
              >
                <Sparkles size={14} /> Pre-fill requisition
              </button>
            </div>
          ) : (
            <RequisitionPanel req={req} actor={actor} onRun={run} pending={pending} />
          )}
        </Stage>

        {/* Stage 5 — DOA approval */}
        <Stage n="5" icon={Stamp} title="Route the DOA approval" state={stageState("approval")}>
          {approvals.length === 0 ? (
            <p className="text-sm text-ink-3">
              On submission, the requisition routes to the correct approver by
              dollar threshold — the sign-off stays human.
            </p>
          ) : (
            <div className="space-y-2.5">
              {approvals.map((a) => (
                <div key={a.id} className="rounded-lg border border-rule px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-ink">
                        {a.role || "Approver"}
                      </span>
                      {a.approver_name ? (
                        <span className="text-[12px] text-ink-3">
                          {" "}
                          · {a.approver_name}
                        </span>
                      ) : null}
                      <div className="text-[11px] text-ink-3">
                        {fmtMoney(a.amount)} · band {fmtMoney(a.threshold_min ?? 0)}
                        {a.threshold_max != null ? `–${fmtMoney(a.threshold_max)}` : "+"}
                      </div>
                    </div>
                    <Badge tone={approvalBadge(a.status).tone}>
                      {approvalBadge(a.status).label}
                    </Badge>
                  </div>
                  {a.status === "pending" ? (
                    <div className="mt-2.5">
                      <ApprovalButtons
                        approvalId={a.id}
                        approverPersonId={a.approver_person_id}
                        compact
                      />
                    </div>
                  ) : null}
                  {a.status === "escalated" && a.escalated_to_name ? (
                    <p className="mt-1.5 text-[12px] text-ink-3">
                      Auto-escalated to {a.escalated_to_name}
                    </p>
                  ) : null}
                  {a.note ? (
                    <p className="mt-1.5 text-[12px] text-ink-2">“{a.note}”</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Stage>

        {/* Stage 6 — PO */}
        <Stage n="6" icon={ShoppingCart} title="Draft the PO for release" state={stageState("po")}>
          {!po ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-3">
                Reserve drafts the PO in the ERP's format — the buyer reviews and
                releases the binding document.
              </p>
              <button
                onClick={() => run(() => draftPoAction(sb.id))}
                disabled={
                  pending ||
                  !approvals.some((a) => a.status === "approved")
                }
                className="btn btn-primary btn-sm"
              >
                <Sparkles size={14} /> Draft PO
              </button>
            </div>
          ) : (
            <PoPanel po={po} actor={actor} onRun={run} pending={pending} />
          )}
        </Stage>

        {/* Customs (cross-border, parallel to receipt) */}
        {sb.cross_border ? (
          <Stage n="7·" icon={Globe2} title="Assemble the customs packet" state={sb.status === "closed" || sb.status === "receiving" ? "done" : sb.status === "po" ? "active" : "upcoming"}>
            <CustomsPanel
              sb={sb}
              customs={customs}
              actor={actor}
              onRun={run}
              pending={pending}
            />
          </Stage>
        ) : null}

        {/* Stage 7 — Goods receipt & 3-way match */}
        <Stage n="7" icon={PackageCheck} title="Goods receipt & 3-way match" state={stageState("receiving")}>
          {sb.status === "receiving" || (detail.receipts && detail.receipts.length > 0) ? (
            <ReceivingPanel
              spotBuyId={sb.id}
              receipts={detail.receipts ?? []}
              orderedQty={req?.quantity ?? sb.quantity}
              uom={req?.uom ?? sb.uom}
              poAmount={po?.total_value ?? req?.total_value ?? 0}
              currency={req?.currency ?? "USD"}
              onRun={run}
              pending={pending}
            />
          ) : (
            <p className="text-sm text-ink-3">
              After the PO is released, record the delivery and supplier invoice — a clean
              PO ↔ receipt ↔ invoice match closes the buy.
            </p>
          )}
        </Stage>
      </div>

      {/* Audit trail */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <Eyebrow>Audit trail</Eyebrow>
          <span className="text-[11px] text-ink-3">stronger after Reserve</span>
        </div>
        <Card className="max-h-[560px] overflow-y-auto px-4 py-3">
          {detail.audit.length === 0 ? (
            <p className="text-sm text-ink-3">No events yet.</p>
          ) : (
            <ul className="space-y-3">
              {detail.audit.map((e: any) => (
                <li key={e.id} className="flex gap-2.5">
                  <span className="mt-0.5">
                    <Badge tone={actorBadge(e.actor).tone}>
                      {actorBadge(e.actor).label}
                    </Badge>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{e.action}</p>
                    {e.detail ? (
                      <p className="text-[12px] text-ink-3">{e.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-ink-3">
                      {e.actor_person_name ? `${e.actor_person_name} · ` : ""}
                      {timeAgo(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <AttachmentsPanel spotBuyId={sb.id} attachments={detail.attachments ?? []} />

        {sb.status !== "closed" && sb.status !== "cancelled" ? (
          <button
            onClick={() => run(() => cancelSpotBuyAction(sb.id, actor))}
            disabled={pending}
            className="btn btn-ghost btn-sm mt-3 w-full text-ink-3"
          >
            Cancel spot buy
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---- sub-panels -------------------------------------------------------------

function RfqDraft({ rfq, invites, candidates, actor, onRun, pending }: any) {
  const [body, setBody] = useState(rfq.draft_body || "");
  const invitedIds = new Set(invites.map((i: any) => i.supplier_org_id));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AiTag />
        <span className="text-[12px] text-ink-3">Review and edit before sending.</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => onRun(() => updateRfqBodyAction(rfq.id, body))}
        rows={7}
        className="field resize-y font-mono text-[12px] leading-relaxed"
      />
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-2">
          Approved supplier base — who to broadcast to
        </p>
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((c: any) => {
            const on = invitedIds.has(c.org_id);
            return (
              <button
                key={c.org_id}
                onClick={() =>
                  onRun(() => toggleInviteAction(rfq.id, c.org_id, !on))
                }
                disabled={pending}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                  on
                    ? "border-accent bg-accent-pale text-[#2f4d68]"
                    : "border-rule bg-white text-ink-3 hover:bg-paper-2"
                }`}
              >
                {c.name}
                {c.approved ? (
                  <span className="rounded bg-[#e4efea] px-1 text-[10px] text-good">
                    approved
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={() => onRun(() => approveRfqSendAction(rfq.id, actor))}
        disabled={pending || invites.length === 0}
        className="btn btn-primary btn-sm"
      >
        <Send size={14} /> Approve & broadcast to {invites.length} suppliers
      </button>
    </div>
  );
}

function RfqSent({ invites, spotBuyId, hasQuotes, onRun, pending }: any) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        RFQ broadcast to {invites.length} approved suppliers with timed follow-ups.
      </p>
      <ul className="space-y-1.5">
        {invites.map((iv: any) => (
          <li
            key={iv.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2"
          >
            <span className="text-sm text-ink">{iv.supplier_name}</span>
            <div className="flex items-center gap-2">
              <Badge tone={inviteBadge(iv.status).tone}>
                {inviteBadge(iv.status).label}
              </Badge>
              {iv.status !== "quoted" ? (
                <button
                  onClick={() => onRun(() => followUpInviteAction(iv.id))}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                >
                  Follow up
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!hasQuotes ? (
        <button
          onClick={() => onRun(() => simulateQuotesAction(spotBuyId))}
          disabled={pending}
          className="btn btn-sm"
        >
          <Sparkles size={14} /> Simulate incoming quotes
        </button>
      ) : null}
    </div>
  );
}

function QuoteTable({ quotes, actor, onRun, pending }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-3">
            <th className="py-2 pr-3 font-medium">Supplier</th>
            <th className="py-2 pr-3 font-medium">Unit</th>
            <th className="py-2 pr-3 font-medium">Lead</th>
            <th className="py-2 pr-3 font-medium">Freight</th>
            <th className="py-2 pr-3 font-medium">Landed</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q: any) => (
            <tr
              key={q.id}
              className={`border-b border-rule last:border-0 ${
                q.selected ? "bg-accent-pale/50" : ""
              }`}
            >
              <td className="py-2.5 pr-3">
                <div className="font-medium text-ink">{q.supplier_name}</div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {q.recommended ? (
                    <Badge tone="good">Best value</Badge>
                  ) : null}
                  {q.isCheapest && !q.recommended ? (
                    <Badge tone="accent">Cheapest</Badge>
                  ) : null}
                  {q.isFastest ? <Badge tone="accent">Fastest</Badge> : null}
                  <span className="rounded bg-paper-2 px-1 text-[10px] uppercase text-ink-3">
                    {q.source_format}
                  </span>
                </div>
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                {fmtMoney(q.unit_price)}
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                {q.lead_time_days}d
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                {fmtMoney(q.freight_cost)}
              </td>
              <td className="py-2.5 pr-3 font-medium tabular-nums text-ink">
                {fmtMoney(Math.round(q.landed))}
              </td>
              <td className="py-2.5 pr-3 text-right">
                {q.selected ? (
                  <span className="text-[12px] font-medium text-good">Selected</span>
                ) : (
                  <button
                    onClick={() => onRun(() => selectQuoteAction(q.id, actor))}
                    disabled={pending}
                    className="btn btn-sm"
                  >
                    Select
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequisitionPanel({ req, actor, onRun, pending }: any) {
  const [material, setMaterial] = useState(req.material_number || "");
  const [cc, setCc] = useState(req.cost_center || "");
  const [needBy, setNeedBy] = useState(
    req.need_by ? String(req.need_by).slice(0, 10) : ""
  );
  const missing: string[] = req.missing || [];
  const submitted = req.status === "submitted";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AiTag />
        {missing.length ? (
          <Badge tone="warn">{missing.length} missing field(s)</Badge>
        ) : (
          <Badge tone="good">Complete</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-rule px-3 py-2.5 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Material</dt>
          <dd className="text-ink-2">{req.material_desc || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Quantity</dt>
          <dd className="text-ink-2">
            {req.quantity} {req.uom}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Unit / freight</dt>
          <dd className="text-ink-2">
            {fmtMoney(req.unit_price)} · {fmtMoney(req.freight_cost)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Total value</dt>
          <dd className="font-medium text-ink">{fmtMoney(req.total_value)}</dd>
        </div>
      </dl>

      {!submitted ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Material number</label>
              <input
                className="field"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Cost center</label>
              <input
                className="field"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Need-by</label>
              <input
                type="date"
                className="field"
                value={needBy}
                onChange={(e) => setNeedBy(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onRun(() =>
                  updateRequisitionAction(req.id, {
                    material_number: material || null,
                    cost_center: cc || null,
                    need_by: needBy || null,
                  })
                )
              }
              disabled={pending}
              className="btn btn-sm"
            >
              Save fields
            </button>
            <button
              onClick={() => onRun(() => submitRequisitionAction(req.id, actor))}
              disabled={pending || missing.length > 0}
              className="btn btn-primary btn-sm"
              title={missing.length ? "Fill flagged fields first" : ""}
            >
              Submit requisition
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-good">Requisition submitted and routed.</p>
      )}
    </div>
  );
}

function PoPanel({ po, actor, onRun, pending }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AiTag />
        <span className="mono text-[13px] font-medium text-ink">{po.po_number}</span>
        <Badge tone={poBadge(po.status).tone}>{poBadge(po.status).label}</Badge>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {po.lines.map((l: any) => (
            <tr key={l.id} className="border-b border-rule last:border-0">
              <td className="py-1.5 text-ink-2">{l.description}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-3">
                {l.quantity} {l.uom}
              </td>
              <td className="py-1.5 pl-3 text-right font-medium tabular-nums text-ink">
                {fmtMoney(Math.round(l.amount))}
              </td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 text-[11px] uppercase text-ink-3">Total</td>
            <td></td>
            <td className="pt-2 pl-3 text-right font-medium tabular-nums text-ink">
              {fmtMoney(po.total_value)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        {po.status === "drafted" ? (
          <button
            onClick={() => onRun(() => releasePoAction(po.id, actor))}
            disabled={pending}
            className="btn btn-primary btn-sm"
          >
            Release PO (binding)
          </button>
        ) : (
          <p className="text-sm text-good">PO released to supplier.</p>
        )}
        <a
          href={`/api/reserve/po/${po.id}/export?format=csv`}
          className="btn btn-sm"
          title="ERP-import-ready CSV"
        >
          Export CSV
        </a>
        <a
          href={`/api/reserve/po/${po.id}/export?format=json`}
          className="btn btn-sm"
          title="Structured PO document"
        >
          Export JSON
        </a>
        <a
          href={`/api/reserve/po/${po.id}/export?format=cxml`}
          className="btn btn-sm"
          title="Ariba/Coupa cXML OrderRequest"
        >
          cXML
        </a>
        <a
          href={`/api/reserve/po/${po.id}/export?format=edi850`}
          className="btn btn-sm"
          title="ANSI X12 EDI 850"
        >
          EDI 850
        </a>
      </div>
    </div>
  );
}

function CustomsPanel({ sb, customs, actor, onRun, pending }: any) {
  const assembled = customs && customs.status !== "not_required" && customs.hs_code;
  if (!assembled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          Section 232: {sb.metal} needs a mill certificate and country-of-
          {sb.metal === "steel" ? "melt-and-pour" : "smelt-and-cast"} declaration.
          A missing cert can hold the shipment at the border.
        </p>
        <button
          onClick={() => onRun(() => assembleCustomsAction(sb.id))}
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          <Sparkles size={14} /> Assemble packet
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AiTag />
        <Badge tone={customsBadge(customs.status).tone}>
          {customsBadge(customs.status).label}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-rule px-3 py-2.5 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase text-ink-3">HS code</dt>
          <dd className="text-ink-2">{customs.hs_code}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">
            {sb.metal === "steel" ? "Melt & pour" : "Smelt & cast"}
          </dt>
          <dd className="text-ink-2">
            {customs.country_of_melt_pour || customs.country_of_smelt_cast || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Commercial invoice</dt>
          <dd className="text-ink-2 capitalize">{customs.commercial_invoice_status}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-ink-3">Mill certificate</dt>
          <dd className="text-ink-2 capitalize">{customs.mill_cert_status}</dd>
        </div>
      </dl>
      {customs.status !== "verified" ? (
        <button
          onClick={() =>
            onRun(() => verifyCustomsAction(customs.id, customs.broker_person_id))
          }
          disabled={pending}
          className="btn btn-good btn-sm"
        >
          Broker verify & close
        </button>
      ) : (
        <p className="text-sm text-good">Customs verified — border hold avoided.</p>
      )}
    </div>
  );
}
