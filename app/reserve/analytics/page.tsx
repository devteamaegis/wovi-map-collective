import { PageContainer, PageHeader } from "@/components/Page";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { cycleAnalytics, APQC_BENCHMARK_HOURS } from "@/lib/repos/analytics";
import { fmtMoney } from "@/lib/reserve/logic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

function hrs(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

export default function AnalyticsPage() {
  const a = cycleAnalytics();
  const maxStage = Math.max(0.01, ...a.stages.map((s) => s.avgHours ?? 0));

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Reserve · Analytics"
        title="Cycle time vs the 5-hour benchmark"
        description="Every duration is reconstructed from the audit ledger. The target is an urgent buy resolved end-to-end within APQC's world-class 5-hour window — days compressed to hours."
      />

      {a.closedCount === 0 ? (
        <EmptyState
          title="No closed spot buys yet"
          description="Once buys are driven to a clean 3-way-matched close, per-stage timings and downtime-avoided appear here."
        />
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Closed buys" value={String(a.closedCount)} />
            <Kpi label="Median resolution" value={hrs(a.medianResolutionHours)} sub={`avg ${hrs(a.avgResolutionHours)}`} />
            <Kpi
              label={`Under ${APQC_BENCHMARK_HOURS}h`}
              value={a.pctUnderBenchmark == null ? "—" : `${Math.round(a.pctUnderBenchmark)}%`}
              tone={a.pctUnderBenchmark != null && a.pctUnderBenchmark >= 50 ? "good" : "warn"}
            />
            <Kpi label="Downtime avoided" value={fmtMoney(Math.round(a.totalDowntimeAvoided))} sub="vs 72h manual baseline" />
          </div>

          {/* Stage breakdown */}
          <Card className="px-5 py-4">
            <Eyebrow>Average time per stage</Eyebrow>
            <div className="mt-4 space-y-2.5">
              {a.stages.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-[12px] text-ink-2">{s.label}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-paper-2">
                    <div
                      className="h-full rounded-md bg-navy/85"
                      style={{ width: `${((s.avgHours ?? 0) / maxStage) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-ink-2">
                    {hrs(s.avgHours)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[10px] text-ink-3">
                    n={s.samples}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
              Stage boundaries are milestone audit events (RFQ broadcast, first quote, selection, submission,
              approval, PO release, close). Stages with no sample are skipped.
            </p>
          </Card>

          {/* Resolution table */}
          <Card className="px-5 py-4">
            <Eyebrow>Resolution by spot buy</Eyebrow>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-3">
                    <th scope="col" className="py-2 pr-3 font-medium">Ref</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Title</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Resolution</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Downtime avoided</th>
                  </tr>
                </thead>
                <tbody>
                  {a.resolutions.map((r) => (
                    <tr key={r.id} className="border-b border-rule/60">
                      <td className="py-2.5 pr-3 font-mono text-[12px] text-ink-2">{r.ref}</td>
                      <td className="py-2.5 pr-3 text-ink">{r.title}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={r.underBenchmark ? "good" : "warn"}>{hrs(r.hours)}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                        {r.downtimeAvoided > 0 ? fmtMoney(Math.round(r.downtimeAvoided)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  const valueColor = tone === "good" ? "text-[#2c5d4e]" : tone === "warn" ? "text-[#8a5d21]" : "text-ink";
  return (
    <Card className="px-4 py-3.5">
      <p className="mono text-[10px] uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`serif mt-1 text-2xl ${valueColor}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-ink-3">{sub}</p> : null}
    </Card>
  );
}
