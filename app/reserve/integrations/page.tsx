import { PageContainer, PageHeader } from "@/components/Page";
import { IntegrationsPanel } from "@/components/reserve/IntegrationsPanel";
import { IntegrationsExtra } from "@/components/reserve/IntegrationsExtra";
import { getApiToken, getSetting, listOutbox, listChannels, emailConfigured } from "@/lib/repos/settings";
import { doaRules, pendingJobs } from "@/lib/repos/reserve";
import { listFxRates } from "@/lib/repos/fx";
import { listPeople } from "@/lib/repos/people";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  const db = getDb();
  const rules = doaRules().map((r) => ({
    ...r,
    approver_name: r.approver_person_id
      ? ((db.prepare("SELECT name FROM people WHERE id=?").get(r.approver_person_id) as
          | { name: string }
          | undefined)?.name ?? null)
      : null,
  }));
  const people = listPeople().map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
  }));

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Reserve · Integrations"
        title="Connect Reserve to your existing systems"
        description="Reserve sits alongside the ERP as a system of engagement — it ingests urgent-need signals and hands back clean, approved, documented POs. No deep write-back integration required to deliver value."
      />
      <IntegrationsPanel
        token={getApiToken()}
        slackUrl={getSetting("slack_webhook_url")}
        doaRules={rules}
        people={people}
        outbox={listOutbox(20)}
      />
      <div className="mt-6">
        <IntegrationsExtra
          channels={listChannels()}
          fxRates={listFxRates()}
          jobs={pendingJobs()}
          emailConfigured={emailConfigured()}
          token={getApiToken()}
        />
      </div>
    </PageContainer>
  );
}
