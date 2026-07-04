import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, User } from "lucide-react";
import { PageContainer, Field } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import {
  Badge,
  consentBadge,
  edgeKindBadge,
  consentRecordBadge,
} from "@/components/Badge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { PersonForm } from "@/components/PersonForm";
import { DeleteButton } from "@/components/DeleteButton";
import { AddEdgeForm } from "@/components/AddEdgeForm";
import { GraphSnapshot } from "@/components/GraphSnapshot";
import {
  getPerson,
  personOutreach,
  personConsents,
} from "@/lib/repos/people";
import { listOrgs } from "@/lib/repos/orgs";
import { nodeDetail } from "@/lib/repos/detail";
import { neighborhoodGraph, graphData } from "@/lib/repos/graph";
import { deletePersonAction } from "@/app/actions";
import { timeAgo, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: idStr } = await params;
  const { edit } = await searchParams;
  const id = Number(idStr);
  const person = getPerson(id);
  if (!person) notFound();
  const detail = nodeDetail("person", id)!;
  const outreach = personOutreach(id);
  const consents = personConsents(id);
  const neighborhood = neighborhoodGraph("person", id);
  const nodeOptions = graphData().nodes.map((n) => ({
    key: n.key,
    type: n.type,
    id: n.id,
    label: n.label,
  }));

  if (edit) {
    const orgs = listOrgs().map((o) => ({ id: o.id, name: o.name }));
    return (
      <PageContainer className="max-w-3xl">
        <Link
          href={`/directory/person/${id}`}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to person
        </Link>
        <Eyebrow>Edit person</Eyebrow>
        <h1 className="serif mb-6 mt-3 text-2xl text-ink">{person.name}</h1>
        <Card className="px-6 py-6">
          <PersonForm mode="edit" person={person} orgs={orgs} />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link
        href="/directory?tab=people"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Directory
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Person</Eyebrow>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white">
              <User size={18} />
            </span>
            <div>
              <h1 className="serif text-[24px] leading-tight text-ink">
                {person.name}
              </h1>
              <p className="text-[13px] text-ink-3">
                {[person.title, person.org_name].filter(Boolean).join(" · ") ||
                  "Unaffiliated"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/directory/person/${id}?edit=1`} className="btn btn-sm">
            <Pencil size={13} /> Edit
          </Link>
          <DeleteButton
            onDelete={deletePersonAction.bind(null, id)}
            confirmText="Delete this person, their edges and consent records?"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Channels & profile */}
          <Card className="px-5 py-4">
            <Eyebrow>Channels & profile</Eyebrow>
            <div className="mt-3">
              <Field label="Title" value={person.title || "—"} />
              <Field
                label="Organization"
                value={
                  person.org_id ? (
                    <Link
                      href={`/directory/org/${person.org_id}`}
                      className="link-accent"
                    >
                      {person.org_name}
                    </Link>
                  ) : (
                    "Unaffiliated"
                  )
                }
              />
              <Field label="WhatsApp" value={person.whatsapp || "—"} />
              <Field label="WeChat" value={person.wechat || "—"} />
              <Field label="Phone" value={person.phone || "—"} />
              <Field label="Email" value={person.email || "—"} />
            </div>
            {person.notes ? (
              <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[13px] text-ink-2">
                {person.notes}
              </p>
            ) : null}
          </Card>

          {/* Edges bridged */}
          <Card className="px-5 py-4">
            <Eyebrow>Edges bridged ({detail.edges.length})</Eyebrow>
            {detail.edges.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">
                No edges yet. Add one below.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.edges.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2"
                  >
                    <Link
                      href={
                        e.otherType === "org"
                          ? `/directory/org/${e.otherId}`
                          : `/directory/person/${e.otherId}`
                      }
                      className="text-sm font-medium text-ink hover:underline"
                    >
                      {e.otherLabel}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge tone={edgeKindBadge(e.kind).tone}>
                        {edgeKindBadge(e.kind).label}
                      </Badge>
                      <div className="w-24">
                        <ConfidenceBar value={e.confidence} />
                      </div>
                      <Badge tone={consentBadge(e.consent_status).tone}>
                        {consentBadge(e.consent_status).label}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Brokering history */}
          <Card className="px-5 py-4">
            <Eyebrow>Brokering history</Eyebrow>
            <div className="mt-3 space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
                  Paths connected (as connector)
                </p>
                {detail.paths.length === 0 ? (
                  <p className="text-[13px] text-ink-3">None yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.paths.map((p) => (
                      <li key={p.id} className="text-[13px] text-ink-2">
                        {p.need_title || "Path"} ·{" "}
                        <span className="text-ink-3">
                          {p.status} · {p.confidence} conf
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
                  Outreach ({outreach.length})
                </p>
                {outreach.length === 0 ? (
                  <p className="text-[13px] text-ink-3">No outreach logged.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {outreach.slice(0, 6).map((o) => (
                      <li
                        key={o.id}
                        className="rounded-lg border border-rule px-3 py-2 text-[13px]"
                      >
                        <span className="text-[11px] capitalize text-ink-3">
                          {o.channel} ·{" "}
                          {o.direction === "out" ? "outbound" : "inbound"} ·{" "}
                          {timeAgo(o.occurred_at)}
                          {o.outcome ? ` · ${titleCase(o.outcome)}` : ""}
                        </span>
                        <p className="text-ink-2">{o.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
                  Consents ({consents.length})
                </p>
                {consents.length === 0 ? (
                  <p className="text-[13px] text-ink-3">No consent records.</p>
                ) : (
                  <ul className="space-y-1">
                    {consents.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="text-ink-2 capitalize">
                          {c.side} · {timeAgo(c.created_at)}
                        </span>
                        <Badge tone={consentRecordBadge(c.status).tone}>
                          {consentRecordBadge(c.status).label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2.5">
              <Eyebrow>Neighborhood</Eyebrow>
            </div>
            <GraphSnapshot data={neighborhood} />
          </div>

          <Card className="px-5 py-4">
            <Eyebrow>Add edge</Eyebrow>
            <div className="mt-3">
              <AddEdgeForm
                sourceType="person"
                sourceId={id}
                options={nodeOptions}
              />
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
