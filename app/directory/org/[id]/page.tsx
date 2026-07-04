import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Building2 } from "lucide-react";
import { PageContainer, Field } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import {
  Badge,
  orgKindBadge,
  consentBadge,
  edgeKindBadge,
  needStatusBadge,
} from "@/components/Badge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { OrgForm } from "@/components/OrgForm";
import { DeleteButton } from "@/components/DeleteButton";
import { AddEdgeForm } from "@/components/AddEdgeForm";
import { GraphSnapshot } from "@/components/GraphSnapshot";
import { getOrg } from "@/lib/repos/orgs";
import { nodeDetail } from "@/lib/repos/detail";
import { neighborhoodGraph, graphData } from "@/lib/repos/graph";
import { deleteOrgAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: idStr } = await params;
  const { edit } = await searchParams;
  const id = Number(idStr);
  const org = getOrg(id);
  if (!org) notFound();
  const detail = nodeDetail("org", id)!;
  const neighborhood = neighborhoodGraph("org", id);
  const nodeOptions = graphData().nodes.map((n) => ({
    key: n.key,
    type: n.type,
    id: n.id,
    label: n.label,
  }));

  if (edit) {
    return (
      <PageContainer className="max-w-3xl">
        <Link
          href={`/directory/org/${id}`}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to organization
        </Link>
        <Eyebrow>Edit organization</Eyebrow>
        <h1 className="serif mb-6 mt-3 text-2xl text-ink">{org.name}</h1>
        <Card className="px-6 py-6">
          <OrgForm mode="edit" org={org} />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link
        href="/directory"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Directory
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Eyebrow>Organization</Eyebrow>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white">
              <Building2 size={18} />
            </span>
            <div>
              <h1 className="serif text-[24px] leading-tight text-ink">
                {org.name}
              </h1>
              <p className="text-[13px] text-ink-3">
                {[org.country, org.region].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge tone={orgKindBadge(org.kind).tone}>
              {orgKindBadge(org.kind).label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/directory/org/${id}?edit=1`} className="btn btn-sm">
            <Pencil size={13} /> Edit
          </Link>
          <DeleteButton
            onDelete={deleteOrgAction.bind(null, id)}
            confirmText="Delete this organization, its people links and edges?"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <Card className="px-5 py-4">
            <Eyebrow>Profile</Eyebrow>
            <div className="mt-3">
              <Field label="Kind" value={org.kind} />
              <Field label="Country" value={org.country || "—"} />
              <Field label="Region" value={org.region || "—"} />
              <Field
                label="Materials"
                value={
                  org.materials.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {org.materials.map((m) => (
                        <Badge key={m} tone="accent">
                          {m}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Capabilities"
                value={
                  org.capabilities.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {org.capabilities.map((c) => (
                        <Badge key={c} tone="neutral">
                          {c}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
            {org.notes ? (
              <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[13px] text-ink-2">
                {org.notes}
              </p>
            ) : null}
          </Card>

          {/* Edges */}
          <Card className="px-5 py-4">
            <Eyebrow>Edges ({detail.edges.length})</Eyebrow>
            {detail.edges.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">
                No edges yet. Add one below to connect this organization into the
                graph.
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

          {/* Needs & paths */}
          {detail.needs.length > 0 || detail.paths.length > 0 ? (
            <Card className="px-5 py-4">
              <Eyebrow>Needs & paths</Eyebrow>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
                    Needs requested
                  </p>
                  {detail.needs.length === 0 ? (
                    <p className="text-[13px] text-ink-3">None</p>
                  ) : (
                    <ul className="space-y-1">
                      {detail.needs.map((n) => (
                        <li key={n.id} className="text-[13px]">
                          <Link href={`/needs/${n.id}`} className="link-accent">
                            {n.title}
                          </Link>{" "}
                          <Badge tone={needStatusBadge(n.status).tone}>
                            {needStatusBadge(n.status).label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
                    Paths targeting this org
                  </p>
                  {detail.paths.length === 0 ? (
                    <p className="text-[13px] text-ink-3">None</p>
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
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {/* People */}
          <Card className="px-5 py-4">
            <Eyebrow>People ({detail.people.length})</Eyebrow>
            {detail.people.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">No people on record.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/directory/person/${p.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.title ? (
                      <span className="block text-[12px] text-ink-3">
                        {p.title}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Neighborhood */}
          <div>
            <div className="mb-2.5">
              <Eyebrow>Neighborhood</Eyebrow>
            </div>
            <GraphSnapshot data={neighborhood} />
          </div>

          {/* Add edge */}
          <Card className="px-5 py-4">
            <Eyebrow>Add edge</Eyebrow>
            <div className="mt-3">
              <AddEdgeForm
                sourceType="org"
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
