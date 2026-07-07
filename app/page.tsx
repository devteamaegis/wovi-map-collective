import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import {
  Badge,
  needStatusBadge,
  priorityBadge,
  orgKindBadge,
} from "@/components/Badge";
import { NetworkMotif } from "@/components/NetworkMotif";
import { GraphSnapshot } from "@/components/GraphSnapshot";
import { ConsentButtons } from "@/components/ConsentButtons";
import { EmptyState } from "@/components/EmptyState";
import {
  dashboardStats,
  needsThatNeedYou,
  recentlyStrengthened,
} from "@/lib/repos/dashboard";
import { pendingDoubleOptIns } from "@/lib/repos/consents";
import { graphData } from "@/lib/repos/graph";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const LOOP = [
  ["One need", "stated plainly"],
  ["One useful path", "a single trusted route"],
  ["Double opt-in", "both sides consent"],
  ["Outcome compounds", "the graph strengthens"],
];

export default function DashboardPage() {
  const stats = dashboardStats();
  const pending = pendingDoubleOptIns();
  const needs = needsThatNeedYou(6);
  const strengthened = recentlyStrengthened(6);
  const graph = graphData();

  return (
    <PageContainer>
      {/* Hero band */}
      <section
        data-tour="dashboard-loop"
        className="relative mb-7 overflow-hidden rounded-2xl bg-navy px-5 py-6 text-white sm:px-8 sm:py-9"
      >
        <NetworkMotif className="pointer-events-none absolute right-0 top-0 hidden h-full w-[460px] opacity-50 sm:block" />
        <div className="relative max-w-2xl">
          <Eyebrow light>01 Relationship Intelligence</Eyebrow>
          <h1 className="serif mt-4 text-[28px] leading-[1.12] tracking-tight sm:text-4xl">
            Forward-looking supply-chain{" "}
            <span className="italic text-accent-2">relational data.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
            Customs and shipment records only show what already shipped. Wovi
            records the informal relationships sourcing actually runs on — who can
            source what, from whom, and through which trusted path — before a
            transaction happens.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-7 sm:flex sm:flex-wrap">
            {LOOP.map(([a, b], i) => (
              <div
                key={a}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <div className="eyebrow eyebrow--light">
                  0{i + 1}
                </div>
                <div className="serif mt-1 text-sm text-white/90">{a}</div>
                <div className="text-[11px] text-white/65">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stat row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open needs" value={stats.openNeeds} hint="open + brokering" />
        <StatCard label="Paths in progress" value={stats.pathsInProgress} />
        <StatCard
          label="Awaiting double opt-in"
          value={pending.length}
          accent={pending.length > 0}
          hint="one side granted"
        />
        <StatCard label="Edges in graph" value={stats.edges} />
        <StatCard
          label="Avg confidence"
          value={stats.avgConfidence}
          hint="across all edges"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Needs that need you */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow as="h2">Needs that need you</Eyebrow>
            <Link href="/needs" className="link-accent text-[13px]">
              All needs →
            </Link>
          </div>
          {needs.length === 0 ? (
            <EmptyState
              title="No open needs"
              description="Every need is matched or closed. Create a new one to start brokering."
              action={
                <Link href="/needs/new" className="btn btn-primary btn-sm">
                  New need
                </Link>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {needs.map((n) => (
                <Link
                  key={n.id}
                  href={`/needs/${n.id}`}
                  className="card block px-4 py-3.5 transition-colors hover:bg-[#f1f4f7]/55"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ClipboardList size={15} className="text-ink-3" />
                        <h3 className="truncate font-medium text-ink">
                          {n.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-[12px] text-ink-3">
                        {n.requester_org_name || "Unassigned"} ·{" "}
                        {n.material_tag || n.kind} ·{" "}
                        {n.target_region || "any region"}
                      </p>
                    </div>
                    <ArrowUpRight size={16} className="mt-1 shrink-0 text-ink-3" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={needStatusBadge(n.status).tone}>
                      {needStatusBadge(n.status).label}
                    </Badge>
                    <Badge tone={priorityBadge(n.priority).tone}>
                      {priorityBadge(n.priority).label} priority
                    </Badge>
                    <span className="text-[11px] text-ink-3">
                      {n.path_count} path{n.path_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Recently strengthened */}
          <div className="mb-3 mt-8 flex items-center gap-2">
            <Eyebrow as="h2">Recently strengthened</Eyebrow>
          </div>
          {strengthened.length === 0 ? (
            <Card className="px-4 py-4 text-sm text-ink-3">
              No outcomes recorded yet.
            </Card>
          ) : (
            <Card className="divide-y divide-rule">
              {strengthened.map((s) => (
                <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e4efea] text-good-text">
                    <TrendingUp size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink-2">
                      <span className="font-medium text-ink">
                        {s.edge_label || "An edge"}
                      </span>{" "}
                      {s.note}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-3">
                      {timeAgo(s.created_at)}
                    </p>
                  </div>
                  {s.confidence_delta > 0 ? (
                    <span className="mono shrink-0 text-[12px] font-medium text-good">
                      +{s.confidence_delta}
                    </span>
                  ) : null}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Awaiting consent */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow as="h2">Awaiting consent</Eyebrow>
            <Link href="/consent" className="link-accent text-[13px]">
              Consent center →
            </Link>
          </div>
          {pending.length === 0 ? (
            <Card className="px-4 py-6 text-center">
              <ShieldCheck size={22} className="mx-auto text-good" />
              <p className="mt-2 text-sm text-ink-2">No pending double opt-ins.</p>
              <p className="text-[12px] text-ink-3">
                Everything that needs a second yes has it.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {pending.map((p) => (
                <Card key={p.waiting_consent_id} className="px-4 py-3.5">
                  <p className="text-[11px] uppercase tracking-wide text-[#8a5d21]">
                    {p.granted_side} granted · {p.waiting_side} pending
                  </p>
                  <Link
                    href={p.need_id ? `/needs/${p.need_id}` : "/consent"}
                    className="mt-1 block font-medium text-ink hover:underline"
                  >
                    {p.need_title || "Path awaiting consent"}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    Waiting on{" "}
                    <span className="text-ink-2">
                      {p.waiting_person_name || "the other side"}
                    </span>
                  </p>
                  <div className="mt-2.5">
                    <ConsentButtons
                      consentId={p.waiting_consent_id}
                      status="pending"
                      compact
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph snapshot */}
      <div className="mt-9">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow as="h2">03 The relationship graph</Eyebrow>
          <Link href="/graph" className="link-accent text-[13px]">
            Open full graph →
          </Link>
        </div>
        <GraphSnapshot data={graph} />
      </div>
    </PageContainer>
  );
}
