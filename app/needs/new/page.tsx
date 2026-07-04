import { PageContainer, PageHeader } from "@/components/Page";
import { Card } from "@/components/Card";
import { NewNeedForm } from "@/components/needs/NewNeedForm";
import { listOrgs } from "@/lib/repos/orgs";
import { listPeople } from "@/lib/repos/people";

export const dynamic = "force-dynamic";

export default function NewNeedPage() {
  const orgs = listOrgs().map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
  const people = listPeople().map((p) => ({
    id: p.id,
    name: p.name,
    org_id: p.org_id,
    title: p.title,
  }));

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="New need"
        title="State one need"
        description="The first step of the loop. Once created, the workspace will surface the single most promising trusted path toward it."
      />
      <Card className="px-6 py-6">
        <NewNeedForm orgs={orgs} people={people} />
      </Card>
    </PageContainer>
  );
}
