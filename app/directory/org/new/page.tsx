import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { OrgForm } from "@/components/OrgForm";

export const dynamic = "force-dynamic";

export default function NewOrgPage() {
  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/directory"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Directory
      </Link>
      <Eyebrow>New organization</Eyebrow>
      <h1 className="serif mb-6 mt-3 text-2xl text-ink">
        Add an organization to the graph
      </h1>
      <Card className="px-6 py-6">
        <OrgForm mode="create" />
      </Card>
    </PageContainer>
  );
}
