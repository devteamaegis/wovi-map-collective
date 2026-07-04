import Link from "next/link";
import { Plus, ArrowUpRight, Building2, Package, Globe2 } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { StatCard } from "@/components/StatCard";
import { Filters } from "@/components/Filters";
import { EmptyState } from "@/components/EmptyState";
import { NetworkMotif } from "@/components/NetworkMotif";
import { Badge } from "@/components/Badge";
import {
  triggerBadge,
  urgencyBadge,
  spotStatusBadge,
} from "@/components/reserve/badges";
import { DowntimeClock } from "@/components/reserve/DowntimeClock";
import { listSpotBuys, reserveStats } from "@/lib/repos/reserve";
import { fmtMoney } from "@/lib/reserve/logic";
import type { SpotBuyStatus, Urgency, SpotBuyTrigger } from "@/lib/reserve/types";

export const dynamic = "force-dynamic";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const stats = reserveStats();
  const buys = listSpotBuys({
    q: sp.q,
    status: (sp.status as SpotBuyStatus) || "open",
    urgency: (sp.urgency as Urgency) || "all",
    trigger: (sp.trigger as SpotBuyTrigger) || "all",
    sort: (sp.sort as "urgency" | "recent" | "exposure") || "urgency",
  });

  return (
    <PageContainer>
      {/* Hero band */}
      <section className="relative mb-7 overflow-hidden rounded-2xl bg-navy px-5 py-6 text-white sm:px-8 sm:py-9">
        <NetworkMotif className="pointer-events-none absolute right-0 top-0 hidden h-full w-[460px] opacity-40 sm:block" />
        <div className="relative max-w-2xl">
          <Eyebrow light>Reserve · Spot-buy execution</Eyebrow>
          <h1 className="serif mt-4 text-[28px] leading-[1.12] tracking-tight sm:text-4xl">
            The urgent buy, from days to{" "}
            <span className="italic text-accent-2">hours.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
            When supply breaks, Reserve runs the manual connective work — draft &
            broadcast the RFQ, normalize the quotes, pre-fill the requisition,
            route the approval, draft the PO, assemble the customs packet. AI
            drafts; the human keeps every control.
          </p>
        </div>
      </section>

      {/* Stat row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open spot buys" value={stats.openBuys} />
        <StatCard
          label="Critical"
          value={stats.critical}
          accent={stats.critical > 0}
          hint="line-down risk"
        />
        <StatCard
          label="Awaiting approval"
          value={stats.awaitingApproval}
          hint="DOA queue"
        />
        <StatCard label="POs released" value={stats.poReleased} />
        <StatCard
          label="Exposure / hr"
          value={fmtMoney(stats.totalExposurePerHour)}
          hint="open lines at risk"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Eyebrow>Urgent-need queue</Eyebrow>
        <Link href="/reserve/new" className="btn btn-primary btn-sm">
          <Plus size={14} /> New spot buy
        </Link>
      </div>

      <div className="mb-5">
        <Filters
          fields={[
            { type: "search", name: "q", label: "Search", placeholder: "Search material, ref, buyer…" },
            {
              type: "select",
              name: "status",
              label: "Stage",
              options: [
                { value: "open", label: "Open (all stages)" },
                { value: "triage", label: "Triage" },
                { value: "sourcing", label: "Sourcing" },
                { value: "quoting", label: "Quoting" },
                { value: "requisition", label: "Requisition" },
                { value: "approval", label: "Awaiting approval" },
                { value: "po", label: "PO" },
                { value: "closed", label: "Closed" },
                { value: "all", label: "All" },
              ],
            },
            {
              type: "select",
              name: "urgency",
              label: "Urgency",
              options: [
                { value: "all", label: "All urgency" },
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "med", label: "Medium" },
                { value: "low", label: "Low" },
              ],
            },
            {
              type: "select",
              name: "trigger",
              label: "Trigger",
              options: [
                { value: "all", label: "All triggers" },
                { value: "line_down", label: "Line down" },
                { value: "quality_rejection", label: "Quality rejection" },
                { value: "shortage", label: "Shortage" },
                { value: "mrp_exception", label: "MRP exception" },
                { value: "volume_change", label: "Volume change" },
                { value: "force_majeure", label: "Force majeure" },
              ],
            },
            {
              type: "select",
              name: "sort",
              label: "Sort by",
              options: [
                { value: "urgency", label: "Urgency" },
                { value: "recent", label: "Most recent" },
                { value: "exposure", label: "Exposure/hr" },
              ],
            },
          ]}
        />
      </div>

      {buys.length === 0 ? (
        <EmptyState
          title="No spot buys match these filters"
          description="Clear the filters, or log a new urgent need to start the clock."
          action={
            <Link href="/reserve/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> New spot buy
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {buys.map((b) => (
            <Link
              key={b.id}
              href={`/reserve/${b.id}`}
              className="card group flex flex-col px-4 py-4 transition-colors hover:bg-paper-2/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[11px] text-ink-3">{b.ref}</span>
                    {b.cross_border ? (
                      <Globe2 size={12} className="text-ink-3" />
                    ) : null}
                  </div>
                  <h3 className="mt-0.5 truncate font-medium text-ink">{b.title}</h3>
                </div>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={urgencyBadge(b.urgency).tone}>
                  {urgencyBadge(b.urgency).label}
                </Badge>
                <Badge tone={triggerBadge(b.trigger).tone}>
                  {triggerBadge(b.trigger).label}
                </Badge>
                <Badge tone={spotStatusBadge(b.status).tone}>
                  {spotStatusBadge(b.status).label}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
                <span className="inline-flex items-center gap-1">
                  <Building2 size={13} /> {b.buyer_org_name || "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package size={13} /> {b.quantity}
                  {b.uom ? ` ${b.uom}` : ""}
                </span>
              </div>

              <div className="mt-3 border-t border-rule pt-2.5">
                <DowntimeClock
                  createdAt={b.created_at}
                  costPerHour={b.downtime_cost_per_hour}
                  closedAt={b.closed_at}
                  compact
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
