"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Radio,
  ShieldCheck,
  CheckCircle2,
  Building2,
  User,
  Plus,
  Send,
} from "lucide-react";
import {
  promotePathAction,
  addOutreachAction,
  ensureConsentsAction,
  setPathStatusAction,
  setNeedStatusAction,
} from "@/app/actions";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ConsentButtons } from "@/components/ConsentButtons";
import {
  Badge,
  pathStatusBadge,
  consentBadge,
  edgeKindBadge,
  consentRecordBadge,
  outcomeBadge,
} from "@/components/Badge";
import { timeAgo, titleCase } from "@/lib/format";
import type {
  NodeType,
  Channel,
  Direction,
  OutreachOutcome,
} from "@/lib/types";

interface Hop {
  type: NodeType;
  id: number;
  label: string;
  sublabel: string | null;
}
interface EdgeChainItem {
  fromLabel: string;
  toLabel: string;
  confidence: number;
  edgeId?: number | null;
  kind?: string;
  consent?: string;
}
interface Suggestion {
  targetOrgId: number;
  targetOrgName: string;
  connectorPersonId: number | null;
  connectorName: string | null;
  pathConfidence: number;
  hopCount: number;
  hops: Hop[];
  edgeChain: EdgeChainItem[];
  rationale: string;
}
interface PathPayload {
  id: number;
  status: string;
  confidence: number;
  rationale: string | null;
  target_org_id: number | null;
  connector_person_id: number | null;
  hops: Hop[];
  edgeChain: { fromLabel: string; toLabel: string; confidence: number; edgeId: number | null }[];
  outreach: any[];
  consents: any[];
  outcomes: any[];
}
interface PersonOpt {
  id: number;
  name: string;
  title: string | null;
  org_name: string | null;
}
interface NeedLite {
  id: number;
  status: string;
  requester_org_id: number | null;
  requester_person_id: number | null;
  material_tag: string | null;
  target_region: string | null;
}

function HopChain({
  hops,
  confidences,
}: {
  hops: Hop[];
  confidences: number[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hops.map((h, i) => (
        <span key={`${h.type}-${h.id}-${i}`} className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-white px-2.5 py-1.5">
            {h.type === "org" ? (
              <Building2 size={13} className="text-ink-3" />
            ) : (
              <User size={13} className="text-ink-3" />
            )}
            <span className="text-[13px] font-medium text-ink">{h.label}</span>
          </span>
          {i < hops.length - 1 ? (
            <span className="flex flex-col items-center px-0.5">
              <span className="mono text-[10px] leading-none text-accent">
                {confidences[i] ?? 0}
              </span>
              <ArrowRight size={14} className="text-ink-3" />
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function NeedWorkspace({
  need,
  suggestions,
  paths,
  people,
}: {
  need: NeedLite;
  suggestions: Suggestion[];
  paths: PathPayload[];
  people: PersonOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const promote = (s: Suggestion) => {
    startTransition(async () => {
      await promotePathAction({
        need_id: need.id,
        target_org_id: s.targetOrgId,
        connector_person_id: s.connectorPersonId,
        rationale: s.rationale,
        hops: s.hops.map((h) => ({ type: h.type, id: h.id })),
      });
      router.refresh();
    });
  };

  const advance = (pathId: number, status: string) => {
    startTransition(async () => {
      await setPathStatusAction(pathId, status as any);
      router.refresh();
    });
  };

  const setNeed = (status: "open" | "brokering" | "matched" | "closed") => {
    startTransition(async () => {
      await setNeedStatusAction(need.id, status);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      {/* (a) Suggested paths */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Suggested paths — one useful route</Eyebrow>
          <span className="text-[12px] text-ink-3">
            ranked by path confidence
          </span>
        </div>
        {suggestions.length === 0 ? (
          <Card className="px-4 py-5 text-sm text-ink-3">
            {paths.length > 0
              ? "No additional routes found beyond the active path(s) below."
              : "No trusted route found from the requester to a matching supplier yet. Add edges in the graph to open one up."}
          </Card>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((s, i) => (
              <Card key={i} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-pale text-accent">
                      <Sparkles size={14} />
                    </span>
                    <div>
                      <p className="font-medium text-ink">
                        Route to {s.targetOrgName}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        {s.connectorName
                          ? `via ${s.connectorName}`
                          : "direct route"}{" "}
                        · {s.hopCount} hop{s.hopCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                    <div className="w-28">
                      <ConfidenceBar value={s.pathConfidence} />
                    </div>
                    <button
                      onClick={() => promote(s)}
                      disabled={pending}
                      className="btn btn-primary btn-sm shrink-0"
                    >
                      Promote to path
                    </button>
                  </div>
                </div>
                <div className="mt-3.5">
                  <HopChain
                    hops={s.hops}
                    confidences={s.edgeChain.map((e) => e.confidence)}
                  />
                </div>
                <p className="mt-2.5 text-[12px] text-ink-3">{s.rationale}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* (b–d) Active paths */}
      <section>
        <div className="mb-3">
          <Eyebrow>Active paths</Eyebrow>
        </div>
        {paths.length === 0 ? (
          <Card className="px-4 py-5 text-sm text-ink-3">
            No active path yet. Promote a suggested route above to begin
            brokering — log outreach, then record both consents.
          </Card>
        ) : (
          <div className="space-y-4">
            {paths.map((p) => (
              <PathPanel
                key={p.id}
                path={p}
                people={people}
                onAdvance={advance}
                pending={pending}
              />
            ))}
          </div>
        )}
      </section>

      {/* (e) Close need */}
      <section className="rounded-xl border border-rule bg-paper-2 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Close the loop</Eyebrow>
            <p className="mt-1.5 text-[13px] text-ink-2">
              When the introduction lands, mark the need matched. Close it when no
              longer active.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {need.status !== "matched" ? (
              <button
                onClick={() => setNeed("matched")}
                disabled={pending}
                className="btn btn-good btn-sm"
              >
                <CheckCircle2 size={14} /> Mark matched
              </button>
            ) : null}
            {need.status !== "closed" ? (
              <button
                onClick={() => setNeed("closed")}
                disabled={pending}
                className="btn btn-sm"
              >
                Close need
              </button>
            ) : null}
            {need.status === "matched" || need.status === "closed" ? (
              <button
                onClick={() => setNeed("brokering")}
                disabled={pending}
                className="btn btn-ghost btn-sm"
              >
                Reopen
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function PathPanel({
  path,
  people,
  onAdvance,
  pending,
}: {
  path: PathPayload;
  people: PersonOpt[];
  onAdvance: (id: number, status: string) => void;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const ensureConsents = () => {
    startTransition(async () => {
      await ensureConsentsAction(path.id);
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5">
          <Badge tone={pathStatusBadge(path.status).tone}>
            {pathStatusBadge(path.status).label}
          </Badge>
          <span className="text-[13px] text-ink-2">
            Path #{path.id} · confidence
          </span>
          <div className="w-24">
            <ConfidenceBar value={path.confidence} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {path.status === "proposed" ? (
            <button
              onClick={() => onAdvance(path.id, "outreach")}
              disabled={pending}
              className="btn btn-sm"
            >
              <Radio size={13} /> Begin outreach
            </button>
          ) : null}
          {path.status === "outreach" ? (
            <button
              onClick={() => onAdvance(path.id, "awaiting_consent")}
              disabled={pending}
              className="btn btn-sm"
            >
              Move to awaiting consent
            </button>
          ) : null}
          {path.status !== "consented" && path.status !== "dead" ? (
            <button
              onClick={() => onAdvance(path.id, "dead")}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              Mark dead end
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-3.5 sm:px-5 sm:py-4">
        {/* Hops */}
        <HopChain
          hops={path.hops}
          confidences={path.edgeChain.map((e) => e.confidence)}
        />
        {path.rationale ? (
          <p className="mt-2.5 text-[12px] text-ink-3">{path.rationale}</p>
        ) : null}

        {/* Why this score — path confidence = product of hop-edge confidences */}
        {path.edgeChain.length > 0 ? (
          <details className="mt-3 rounded-lg border border-rule bg-[#f1f4f7]/55">
            <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-ink-2">
              Why this score?{" "}
              <span className="text-ink-3">
                path = product of hop confidences
              </span>
            </summary>
            <div className="border-t border-rule px-3 py-2">
              {path.edgeChain.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-0.5 text-[12px]"
                >
                  <span className="text-ink-2">
                    {e.fromLabel} ↔ {e.toLabel}
                  </span>
                  <span className="mono tabular-nums text-ink-3">
                    {i === 0 ? "" : "× "}
                    {(e.confidence / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-rule pt-1.5 text-[12px]">
                <span className="text-ink-2">= path confidence</span>
                <span className="mono tabular-nums font-medium text-ink">
                  {path.confidence}
                </span>
              </div>
            </div>
          </details>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* (c) Outreach log */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Send size={13} className="text-ink-3" />
              <span className="text-[12px] font-medium uppercase tracking-wide text-ink-3">
                Outreach log
              </span>
            </div>
            <div className="space-y-2">
              {path.outreach.length === 0 ? (
                <p className="text-[13px] text-ink-3">
                  No outreach yet — log the first contact below.
                </p>
              ) : (
                path.outreach.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-rule px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-ink-3">
                      <span className="capitalize">
                        {o.channel} ·{" "}
                        {o.direction === "out" ? "outbound" : "inbound"}
                        {o.person_name ? ` · ${o.person_name}` : ""}
                      </span>
                      <span>{timeAgo(o.occurred_at)}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">{o.summary}</p>
                    {o.outcome ? (
                      <span className="mt-1.5 inline-block text-[11px] font-medium text-accent">
                        → {titleCase(o.outcome)}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <OutreachForm path={path} people={people} />
          </div>

          {/* (d) Consent */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck size={13} className="text-ink-3" />
              <span className="text-[12px] font-medium uppercase tracking-wide text-ink-3">
                Double opt-in consent
              </span>
            </div>
            {path.consents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-rule px-3 py-4 text-center">
                <p className="text-[13px] text-ink-3">
                  No consent records yet. Create the requester + supplier pair to
                  capture each side&apos;s yes.
                </p>
                <button
                  onClick={ensureConsents}
                  disabled={busy}
                  className="btn btn-sm mt-3"
                >
                  <Plus size={13} /> Start double opt-in
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {path.consents.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-rule px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] uppercase tracking-wide text-ink-3">
                          {c.side}
                        </span>
                        <p className="text-[13px] font-medium text-ink">
                          {c.person_name || "—"}
                        </p>
                      </div>
                      <Badge tone={consentRecordBadge(c.status).tone}>
                        {consentRecordBadge(c.status).label}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <ConsentButtons consentId={c.id} status={c.status} compact />
                    </div>
                  </div>
                ))}
                {path.status === "consented" ? (
                  <div className="flex items-center gap-2 rounded-lg bg-[#e4efea] px-3 py-2 text-[12px] text-good">
                    <CheckCircle2 size={14} /> Double opt-in reached — a consented
                    intro edge has formed and the graph strengthened.
                  </div>
                ) : null}
              </div>
            )}

            {/* Outcomes */}
            {path.outcomes.length > 0 ? (
              <div className="mt-3">
                <span className="text-[11px] uppercase tracking-wide text-ink-3">
                  Outcomes
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {path.outcomes.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="text-ink-2">{o.note}</span>
                      <Badge tone={outcomeBadge(o.result).tone}>
                        {outcomeBadge(o.result).label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

const CHANNELS: Channel[] = ["whatsapp", "wechat", "phone", "email", "in_person"];
const OUTCOMES: { value: OutreachOutcome; label: string }[] = [
  { value: "no_reply", label: "No reply" },
  { value: "interested", label: "Interested" },
  { value: "consented", label: "Consented" },
  { value: "corrected", label: "Corrected" },
  { value: "refused", label: "Refused" },
];

function OutreachForm({
  path,
  people,
}: {
  path: PathPayload;
  people: PersonOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [direction, setDirection] = useState<Direction>("out");
  const [personId, setPersonId] = useState("");
  const [edgeId, setEdgeId] = useState("");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<OutreachOutcome | "">("");

  const edgeOptions = path.edgeChain.filter((e) => e.edgeId != null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    startTransition(async () => {
      await addOutreachAction({
        path_id: path.id,
        edge_id: edgeId ? Number(edgeId) : null,
        channel,
        direction,
        person_id: personId ? Number(personId) : null,
        summary: summary.trim(),
        outcome: outcome || null,
      });
      setSummary("");
      setOutcome("");
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-sm mt-2.5">
        <Plus size={13} /> Log outreach
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2.5 space-y-2.5 rounded-lg border border-rule bg-paper-2 p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          className="field"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          <option value="out">Outbound</option>
          <option value="in">Inbound</option>
        </select>
      </div>
      <select
        className="field"
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
      >
        <option value="">Person (optional)…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.org_name ? ` · ${p.org_name}` : ""}
          </option>
        ))}
      </select>
      {edgeOptions.length > 0 ? (
        <select
          className="field"
          value={edgeId}
          onChange={(e) => setEdgeId(e.target.value)}
        >
          <option value="">Relationship affected (optional)…</option>
          {edgeOptions.map((e) => (
            <option key={e.edgeId} value={String(e.edgeId)}>
              {e.fromLabel} ↔ {e.toLabel}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        className="field resize-y"
        rows={2}
        placeholder="What happened? e.g. 'Asked Raj to open a door to Sahel…'"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <select
        className="field"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as OutreachOutcome)}
      >
        <option value="">Outcome (optional)…</option>
        {OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          Save outreach
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
