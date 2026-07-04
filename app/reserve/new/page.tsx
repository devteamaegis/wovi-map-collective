import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { NewSpotBuyForm } from "@/components/reserve/NewSpotBuyForm";
import { listOrgs } from "@/lib/repos/orgs";
import { listPeople } from "@/lib/repos/people";

export const dynamic = "force-dynamic";

export default function NewSpotBuyPage() {
  const orgs = listOrgs().map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
  const people = listPeople().map((p) => ({
    id: p.id,
    name: p.name,
    org_id: p.org_id,
    title: p.title,
  }));

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/reserve"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Spot buys
      </Link>
      <Eyebrow>New spot buy · Triage</Eyebrow>
      <h1 className="serif mb-2 mt-3 text-[24px] leading-tight text-ink">
        Log the urgent need
      </h1>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-ink-3">
        Aggregate the trigger into one queue so detection no longer depends on a
        human noticing across MRP, quality, and line-down alerts.
      </p>
      <Card className="px-6 py-6">
        <NewSpotBuyForm orgs={orgs} people={people} />
      </Card>
    </PageContainer>
  );
}
