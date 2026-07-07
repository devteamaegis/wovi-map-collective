import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Factory, Globe2 } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Badge } from "@/components/Badge";
import {
  triggerBadge,
  urgencyBadge,
  spotStatusBadge,
} from "@/components/reserve/badges";
import { DowntimeClock } from "@/components/reserve/DowntimeClock";
import { SpotBuyWorkspace } from "@/components/reserve/SpotBuyWorkspace";
import { spotBuyDetail } from "@/lib/repos/reserve";
import { TRIGGER_LABEL } from "@/lib/reserve/logic";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = spotBuyDetail(Number(id));
  return { title: d ? `${d.spotBuy.ref} — ${d.spotBuy.title}` : "Spot buy" };
}

export default async function SpotBuyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const detail = spotBuyDetail(Number(idStr));
  if (!detail) notFound();
  const sb = detail.spotBuy;

  return (
    <PageContainer>
      <Link
        href="/reserve"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Spot buys
      </Link>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Eyebrow>Spot buy · {TRIGGER_LABEL[sb.trigger]}</Eyebrow>
            <span className="mono text-[11px] text-ink-3">{sb.ref}</span>
          </div>
          <h1 className="serif text-[24px] leading-tight text-ink sm:text-[26px]">
            {sb.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={urgencyBadge(sb.urgency).tone}>
              {urgencyBadge(sb.urgency).label}
            </Badge>
            <Badge tone={triggerBadge(sb.trigger).tone}>
              {triggerBadge(sb.trigger).label}
            </Badge>
            <Badge tone={spotStatusBadge(sb.status).tone}>
              {spotStatusBadge(sb.status).label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Building2 size={13} /> {sb.buyer_org_name || "—"}
              {sb.buyer_person_name ? ` · ${sb.buyer_person_name}` : ""}
            </span>
            {sb.plant ? (
              <span className="inline-flex items-center gap-1">
                <Factory size={13} /> {sb.plant}
              </span>
            ) : null}
            {sb.material_number ? (
              <span className="mono">{sb.material_number}</span>
            ) : null}
            {sb.cross_border ? (
              <span className="inline-flex items-center gap-1">
                <Globe2 size={13} /> {sb.ship_from_country} → {sb.ship_to_country}
              </span>
            ) : null}
          </div>
        </div>

        <DowntimeClock
          createdAt={sb.created_at}
          costPerHour={sb.downtime_cost_per_hour}
          closedAt={sb.closed_at}
        />
      </div>

      <SpotBuyWorkspace detail={detail} />
    </PageContainer>
  );
}
