"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Upload,
  Slack,
  Trash2,
  Plus,
} from "lucide-react";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Badge } from "@/components/Badge";
import { timeAgo } from "@/lib/format";
import { fmtMoney } from "@/lib/reserve/logic";
import {
  rotateApiTokenAction,
  saveSlackUrlAction,
  testSlackAction,
  importVendorsAction,
  addDoaRuleAction,
  deleteDoaRuleAction,
} from "@/app/reserve/actions";

interface DoaRuleRow {
  id: number;
  role: string;
  min_amount: number;
  max_amount: number | null;
  approver_person_id: number | null;
  approver_name: string | null;
}
interface PersonOpt {
  id: number;
  name: string;
  title: string | null;
}
interface OutboxItem {
  id: number;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  error: string | null;
  created_at: string;
  spot_buy_id: number | null;
}

const SAMPLE_CSV = `name,country,region,materials,capabilities,contact_name,contact_email
Rustbelt Steel Works,United States,North America,steel;hot-rolled coil,hot rolling;coil,Hank Dolan,hank@rustbeltsteel.com
Nordal Aluminium,Norway,Europe,aluminum;aluminum plate,casting;plate,Sigrid Haugen,sigrid@nordal.no`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="btn btn-ghost btn-sm shrink-0"
      aria-label="Copy"
    >
      {copied ? <Check size={13} className="text-good" /> : <Copy size={13} />}
    </button>
  );
}

export function IntegrationsPanel({
  token,
  slackUrl,
  doaRules,
  people,
  outbox,
}: {
  token: string | null;
  slackUrl: string | null;
  doaRules: DoaRuleRow[];
  people: PersonOpt[];
  outbox: OutboxItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  // Slack
  const [slack, setSlack] = useState(slackUrl ?? "");
  const [slackResult, setSlackResult] = useState<string | null>(null);

  // CSV import
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // DOA form
  const [role, setRole] = useState("");
  const [minA, setMinA] = useState("");
  const [maxA, setMaxA] = useState("");
  const [approver, setApprover] = useState("");

  const tokenShown = token ?? "— none yet —";
  const curlTrigger = `curl -X POST ${origin}/api/integrations/triggers \\
  -H "Authorization: Bearer ${token ?? "<token>"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "SAP MRP",
    "title": "Hot-rolled steel coil — stamping line down",
    "trigger": "line_down",
    "urgency": "critical",
    "material_number": "STL-HR-3.0-1250",
    "material_desc": "Hot-rolled steel coil, 3.0mm x 1250mm",
    "quantity": 60000, "uom": "kg",
    "plant": "Leipzig Body Shop", "cost_center": "CC-4021",
    "downtime_cost_per_hour": 2300000,
    "buyer_org": "Voltaic Motors",
    "cross_border": true, "metal": "steel",
    "ship_from_country": "Turkey", "ship_to_country": "Germany"
  }'`;
  const curlQuote = `curl -X POST ${origin}/api/integrations/quotes \\
  -H "Authorization: Bearer ${token ?? "<token>"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "spot_buy_ref": "SB-1041",
    "supplier": "Volga Steelworks",
    "unit_price": 1.12, "quantity": 60000,
    "lead_time_days": 7, "freight_cost": 26000,
    "freight_mode": "air", "source_format": "email"
  }'`;

  return (
    <div className="space-y-6">
      {/* API token + webhooks */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-ink-3" />
          <Eyebrow>Inbound API — triggers & quotes</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          External systems (MRP, quality, line-down alerting, quote parsers) push
          into Reserve over authenticated webhooks. Generate a token, then POST to
          the endpoints below.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="mono min-w-0 flex-1 truncate rounded-lg border border-rule bg-paper-2 px-3 py-2 text-[12px] text-ink-2">
            {tokenShown}
          </code>
          {token ? <CopyButton text={token} /> : null}
          <button
            onClick={() => run(() => rotateApiTokenAction())}
            disabled={pending}
            className="btn btn-sm"
          >
            <RefreshCw size={13} /> {token ? "Rotate token" : "Generate token"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="mono text-[11px] uppercase tracking-wide text-ink-3">
                POST /api/integrations/triggers — urgent-need ingestion
              </span>
              <CopyButton text={curlTrigger} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-navy px-3.5 py-3 text-[11px] leading-relaxed text-white/80">
              {curlTrigger}
            </pre>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="mono text-[11px] uppercase tracking-wide text-ink-3">
                POST /api/integrations/quotes — supplier-quote ingestion
              </span>
              <CopyButton text={curlQuote} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-navy px-3.5 py-3 text-[11px] leading-relaxed text-white/80">
              {curlQuote}
            </pre>
          </div>
          <p className="text-[12px] text-ink-3">
            Health probe (no auth):{" "}
            <code className="mono text-[11px]">GET {origin}/api/integrations/health</code>
          </p>
        </div>
      </Card>

      {/* Vendor master import */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Upload size={15} className="text-ink-3" />
          <Eyebrow>Vendor master import (ERP → Reserve)</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Load the approved supplier base from an ERP vendor-master export. CSV
          columns:{" "}
          <code className="mono text-[11px]">
            name,country,region,materials,capabilities,contact_name,contact_email
          </code>{" "}
          (materials/capabilities separated by “;”). Existing suppliers are
          updated by name.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder={SAMPLE_CSV}
          className="field mt-3 resize-y font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
          <button onClick={() => fileRef.current?.click()} className="btn btn-sm">
            Choose CSV file
          </button>
          <button onClick={() => setCsv(SAMPLE_CSV)} className="btn btn-ghost btn-sm">
            Use sample
          </button>
          <button
            onClick={() =>
              run(async () => {
                const r = await importVendorsAction(csv);
                setImportMsg(
                  `Imported: ${r.created} created, ${r.updated} updated, ${r.contacts} contacts` +
                    (r.errors.length ? ` — ${r.errors.join(" ")}` : "")
                );
              })
            }
            disabled={pending || !csv.trim()}
            className="btn btn-primary btn-sm"
          >
            <Upload size={13} /> Import suppliers
          </button>
          {importMsg ? (
            <span className="text-[12px] font-medium text-good">{importMsg}</span>
          ) : null}
        </div>
      </Card>

      {/* Slack */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Slack size={15} className="text-ink-3" />
          <Eyebrow>Notifications — Slack incoming webhook</Eyebrow>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Approval requests and decisions post to Slack in real time when a
          webhook URL is set. Without one, every message is still recorded in the
          outbox below.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            className="field min-w-0 flex-1"
          />
          <button
            onClick={() => run(() => saveSlackUrlAction(slack))}
            disabled={pending}
            className="btn btn-sm"
          >
            Save
          </button>
          <button
            onClick={() =>
              run(async () => {
                const s = await testSlackAction();
                setSlackResult(
                  s === "sent"
                    ? "Test message delivered."
                    : s === "failed"
                      ? "Delivery failed — check the URL (see outbox for the error)."
                      : "No URL configured — message logged to the outbox."
                );
              })
            }
            disabled={pending}
            className="btn btn-sm"
          >
            Send test
          </button>
          {slackResult ? (
            <span className="text-[12px] text-ink-2">{slackResult}</span>
          ) : null}
        </div>
      </Card>

      {/* DOA matrix */}
      <Card className="px-5 py-4">
        <Eyebrow>Delegation-of-authority matrix</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Requisitions route to the approver whose dollar band contains the total.
          This replaces the spreadsheet the matrix usually lives in.
        </p>
        {doaRules.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-rule px-3 py-3 text-[13px] text-ink-3">
            No rules yet — approvals will route unassigned until you add bands.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {doaRules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium text-ink">{r.role}</span>
                  <span className="ml-2 text-[12px] text-ink-3">
                    {fmtMoney(r.min_amount)}
                    {r.max_amount != null ? `–${fmtMoney(r.max_amount)}` : "+"}
                    {r.approver_name ? ` · ${r.approver_name}` : " · unassigned"}
                  </span>
                </div>
                <button
                  onClick={() => run(() => deleteDoaRuleAction(r.id))}
                  disabled={pending}
                  className="btn btn-ghost btn-sm text-ink-3"
                  aria-label="Delete rule"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. CFO)"
            className="field col-span-2 sm:col-span-1"
          />
          <input
            value={minA}
            onChange={(e) => setMinA(e.target.value)}
            placeholder="Min $"
            type="number"
            className="field"
          />
          <input
            value={maxA}
            onChange={(e) => setMaxA(e.target.value)}
            placeholder="Max $ (blank = ∞)"
            type="number"
            className="field"
          />
          <select
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            className="field"
          >
            <option value="">Approver…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              run(async () => {
                await addDoaRuleAction(
                  role.trim() || "Approver",
                  Number(minA) || 0,
                  maxA === "" ? null : Number(maxA),
                  approver ? Number(approver) : null
                );
                setRole("");
                setMinA("");
                setMaxA("");
                setApprover("");
              })
            }
            disabled={pending || !role.trim()}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} /> Add band
          </button>
        </div>
      </Card>

      {/* Outbox */}
      <Card className="px-5 py-4">
        <Eyebrow>Outbox — every outbound message, logged</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          RFQ broadcasts, follow-ups, approval requests, and PO releases. With no
          mail server configured, messages are recorded here instead of sent —
          the audit stays complete either way.
        </p>
        {outbox.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-rule px-3 py-3 text-[13px] text-ink-3">
            Nothing yet — run a spot buy and the RFQ broadcast will land here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {outbox.map((o) => (
              <li key={o.id} className="rounded-lg border border-rule px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-ink">
                    {o.subject || o.body?.slice(0, 80) || "—"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge tone="neutral">{o.channel}</Badge>
                    <Badge
                      tone={
                        o.status === "sent"
                          ? "good"
                          : o.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {o.status}
                    </Badge>
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  to {o.recipient || "—"} · {timeAgo(o.created_at)}
                  {o.error ? ` · ${o.error}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
