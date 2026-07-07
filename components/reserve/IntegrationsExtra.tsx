"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Coins, Clock, Trash2, Plus, PlayCircle, Mail, Server } from "lucide-react";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Badge } from "@/components/Badge";
import { timeAgo } from "@/lib/format";
import {
  addChannelAction,
  deleteChannelAction,
  setChannelEnabledAction,
  upsertFxRateAction,
  runDueJobsAction,
} from "@/app/reserve/actions";

interface Channel {
  id: number;
  label: string;
  channel: string;
  target: string;
  events: string;
  enabled: number;
}
interface Fx {
  currency: string;
  rate_to_usd: number;
  updated_at: string;
}
interface Job {
  id: number;
  kind: string;
  spot_buy_id: number | null;
  run_at: string;
}

const EVENT_KEYS = ["approval_needed", "approved", "rejected", "test"];

export function IntegrationsExtra({
  channels,
  fxRates,
  jobs,
  emailConfigured,
  token,
}: {
  channels: Channel[];
  fxRates: Fx[];
  jobs: Job[];
  emailConfigured: boolean;
  token: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  const [origin, setOrigin] = useState("http://localhost:3120");
  useEffect(() => setOrigin(window.location.origin), []);

  // channel form
  const [cLabel, setCLabel] = useState("");
  const [cType, setCType] = useState<"slack" | "teams" | "webhook">("teams");
  const [cTarget, setCTarget] = useState("");
  const [cronMsg, setCronMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Notification channels (#12) */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-ink-3" />
          <Eyebrow>Notification channels</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Beyond the single Slack webhook above, add Microsoft Teams or generic webhooks and scope each
          to specific events. Every message is also recorded in the outbox.
        </p>
        {channels.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {channels.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                  <Badge tone="neutral" className="ml-2">{c.channel}</Badge>
                  <div className="truncate text-[11px] text-ink-3">{c.target}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => run(() => setChannelEnabledAction(c.id, !c.enabled))} disabled={pending} className="btn btn-ghost btn-sm">
                    {c.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button onClick={() => run(() => deleteChannelAction(c.id))} disabled={pending} className="btn btn-ghost btn-sm text-ink-3" aria-label="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
          <input value={cLabel} onChange={(e) => setCLabel(e.target.value)} aria-label="Channel label" placeholder="Label" className="field sm:col-span-2" />
          <select value={cType} onChange={(e) => setCType(e.target.value as any)} aria-label="Channel type" className="field">
            <option value="teams">Teams</option>
            <option value="slack">Slack</option>
            <option value="webhook">Webhook</option>
          </select>
          <input value={cTarget} onChange={(e) => setCTarget(e.target.value)} aria-label="Webhook URL" placeholder="Webhook URL" className="field sm:col-span-2" />
          <button
            onClick={() => run(async () => { await addChannelAction({ label: cLabel || cType, channel: cType, target: cTarget, events: [] }); setCLabel(""); setCTarget(""); })}
            disabled={pending || !cTarget.trim()}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} /> Add
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">Events: {EVENT_KEYS.join(", ")} (new channels subscribe to all).</p>
      </Card>

      {/* Email transport (#2) */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-ink-3" />
          <Eyebrow>Email delivery</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          RFQ broadcasts, follow-ups, approval links, and PO releases send over real SMTP when configured;
          otherwise they stay logged in the outbox.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={emailConfigured ? "good" : "neutral"}>
            {emailConfigured ? "SMTP configured — sending live" : "SMTP not configured — logging only"}
          </Badge>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-navy px-3.5 py-3 text-[11px] leading-relaxed text-white/80">
{`# enable real email
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=… SMTP_PASS=…
SMTP_FROM="Reserve <reserve@yourco.com>"
# then: npm install nodemailer

# inbound supplier replies → quotes
POST ${origin}/api/integrations/inbound-email
  Authorization: Bearer ${token ?? "<token>"}
  { "from":"sales@volgasteel.com.tr", "subject":"Re: SB-1041",
    "text":"$1.12/kg, 60,000 kg, 7 days, air freight $26,000, DAP" }`}
        </pre>
      </Card>

      {/* FX rates (#11) */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Coins size={15} className="text-ink-3" />
          <Eyebrow>Currency rates (base USD)</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Quotes in any currency are converted to USD so DOA bands and comparisons are apples-to-apples.
          Rates are editable; wire a daily ERP/FX sync to keep them fresh.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fxRates.map((r) => (
            <label key={r.currency} className="flex items-center gap-2 rounded-lg border border-rule px-2.5 py-1.5">
              <span className="mono w-10 text-[12px] text-ink-2">{r.currency}</span>
              <input
                type="number"
                step="0.0001"
                defaultValue={r.rate_to_usd}
                onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== r.rate_to_usd) run(() => upsertFxRateAction(r.currency, v)); }}
                className="field w-full py-1 text-[12px]"
                disabled={r.currency === "USD"}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* Scheduler (#6) */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-ink-3" />
          <Eyebrow>Scheduled automation</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          RFQ follow-ups and approval escalations fire automatically on an SLA clock. Point a cron at{" "}
          <code className="mono text-[11px]">POST {origin}/api/cron</code> (every few minutes), or run due jobs now.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => run(async () => { const r = await runDueJobsAction(); setCronMsg(`Ran ${r.processed} job(s): ${r.followUps} follow-up(s), ${r.escalations} escalation(s).`); })}
            disabled={pending}
            className="btn btn-sm"
          >
            <PlayCircle size={14} /> Run due jobs now
          </button>
          <span className="text-[12px] text-ink-3">{jobs.length} job(s) pending</span>
          {cronMsg ? <span className="text-[12px] font-medium text-good">{cronMsg}</span> : null}
        </div>
        {jobs.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {jobs.slice(0, 6).map((j) => (
              <li key={j.id} className="flex items-center justify-between rounded-lg border border-rule px-3 py-1.5 text-[12px]">
                <span className="text-ink-2">{j.kind.replace("_", " ")}{j.spot_buy_id ? ` · SB #${j.spot_buy_id}` : ""}</span>
                <span className="text-ink-3">due {timeAgo(j.run_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* ERP endpoints (#7) */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-ink-3" />
          <Eyebrow>ERP connectors</Eyebrow>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-navy px-3.5 py-3 text-[11px] leading-relaxed text-white/80">
{`# PO push formats (from any PO panel)
GET  ${origin}/api/reserve/po/<id>/export?format=csv|json|cxml|edi850

# vendor master sync (Bearer token)
GET  ${origin}/api/erp/vendors                 # pull approved suppliers
POST ${origin}/api/erp/vendors                 # push [{name,country,materials,…}]

# PO acknowledgement callback
POST ${origin}/api/erp/ack   { "po_number":"PO-2026-4501" }`}
        </pre>
      </Card>
    </div>
  );
}
