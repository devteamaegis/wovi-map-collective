import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import {
  Badge,
  consentRecordBadge,
} from "@/components/Badge";
import { ConsentButtons } from "@/components/ConsentButtons";
import { EmptyState } from "@/components/EmptyState";
import { listConsents, pendingDoubleOptIns } from "@/lib/repos/consents";
import type { ConsentContext } from "@/lib/repos/consents";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consent center" };

const GROUPS: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "granted", label: "Granted" },
  { key: "refused", label: "Refused" },
  { key: "revoked", label: "Revoked" },
];

function ConsentRow({ c }: { c: ConsentContext }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{c.person_name || "—"}</span>
          <span className="text-[11px] uppercase tracking-wide text-ink-3">
            {c.side}
          </span>
          {c.person_org ? (
            <span className="text-[12px] text-ink-3">· {c.person_org}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {c.need_title ? (
            <Link href={`/needs/${c.need_id}`} className="link-accent">
              {c.need_title}
            </Link>
          ) : (
            "Standalone consent"
          )}
          {c.edge_label ? ` · ${c.edge_label}` : ""}
          {c.provenance ? ` · ${c.provenance}` : ""}
        </p>
        {c.note ? (
          <p className="mt-1 text-[12px] text-ink-2">“{c.note}”</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Badge tone={consentRecordBadge(c.status).tone}>
          {consentRecordBadge(c.status).label}
        </Badge>
        <ConsentButtons consentId={c.id} status={c.status} compact />
        <span className="text-[11px] text-ink-3">
          {c.decided_at ? `decided ${timeAgo(c.decided_at)}` : `created ${timeAgo(c.created_at)}`}
        </span>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  const consents = listConsents();
  const pending = pendingDoubleOptIns();

  const byStatus = (status: string) =>
    consents.filter((c) => c.status === status);

  return (
    <PageContainer>
      <div data-tour="consent-header">
        <PageHeader
          eyebrow="Consent center"
          title="Both sides consent, every time"
          description="No introduction happens without a double opt-in. Each side's yes is recorded here; when both land, a consented edge forms and the graph strengthens."
        />
      </div>

      {/* Pending double opt-ins */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Eyebrow>Awaiting double opt-in</Eyebrow>
          {pending.length > 0 ? (
            <Badge tone="warn">{pending.length} waiting</Badge>
          ) : null}
        </div>
        {pending.length === 0 ? (
          <Card className="px-4 py-5 text-sm text-ink-3">
            Nothing waiting on a second yes right now.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {pending.map((p) => (
              <Card
                key={p.waiting_consent_id}
                className="border-[#e7d4b6] bg-[#fbf6ee] px-4 py-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-[#8a5d21]">
                      {p.granted_side} granted · {p.waiting_side} pending
                    </p>
                    <Link
                      href={p.need_id ? `/needs/${p.need_id}` : "/consent"}
                      className="mt-0.5 block font-medium text-ink hover:underline"
                    >
                      {p.need_title || "Path awaiting consent"}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      Waiting on{" "}
                      <span className="text-ink-2">
                        {p.waiting_person_name || "the other side"}
                      </span>
                    </p>
                    {p.rationale ? (
                      <p className="mt-1 text-[11px] text-ink-3">{p.rationale}</p>
                    ) : null}
                    <div className="mt-2.5">
                      <ConsentButtons
                        consentId={p.waiting_consent_id}
                        status="pending"
                        compact
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* All consents grouped */}
      {consents.length === 0 ? (
        <EmptyState
          title="No consent records yet"
          description="Start a double opt-in from a need's brokering workspace to capture each side's consent."
        />
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const rows = byStatus(g.key);
            if (rows.length === 0) return null;
            return (
              <section key={g.key}>
                <div className="mb-2.5 flex items-center gap-2">
                  <Eyebrow>{g.label}</Eyebrow>
                  <span className="text-[12px] text-ink-3">{rows.length}</span>
                </div>
                <Card className="divide-y divide-rule">
                  {rows.map((c) => (
                    <ConsentRow key={c.id} c={c} />
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
