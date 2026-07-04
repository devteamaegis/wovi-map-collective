import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { PersonForm } from "@/components/PersonForm";
import { listOrgs } from "@/lib/repos/orgs";

export const dynamic = "force-dynamic";

export default function NewPersonPage() {
  const orgs = listOrgs().map((o) => ({ id: o.id, name: o.name }));
  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/directory"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Directory
      </Link>
      <Eyebrow>New person</Eyebrow>
      <h1 className="serif mb-6 mt-3 text-2xl text-ink">
        Add a person to the graph
      </h1>
      <Card className="px-6 py-6">
        <PersonForm mode="create" orgs={orgs} />
      </Card>
    </PageContainer>
  );
}
