import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/Page";
import { Filters } from "@/components/Filters";
import {
  Badge,
  needStatusBadge,
  priorityBadge,
} from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { listNeeds } from "@/lib/repos/needs";
import type { NeedKind, NeedStatus, Priority } from "@/lib/types";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const needs = listNeeds({
    q: sp.q,
    status: (sp.status as NeedStatus) || "all",
    kind: (sp.kind as NeedKind) || "all",
    priority: (sp.priority as Priority) || "all",
    sort: (sp.sort as "recent" | "priority" | "status") || "recent",
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Needs"
        title="One need, stated plainly"
        description="A buyer states a capability or requirement — a supplier, facility, part, material, or lane. The broker finds one useful trusted path."
        actions={
          <Link href="/needs/new" data-tour="needs-new" className="btn btn-primary">
            <Plus size={15} /> New need
          </Link>
        }
      />

      <div className="mb-5">
        <Filters
          fields={[
            { type: "search", name: "q", label: "Search", placeholder: "Search needs…" },
            {
              type: "select",
              name: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                { value: "open", label: "Open" },
                { value: "brokering", label: "Brokering" },
                { value: "matched", label: "Matched" },
                { value: "closed", label: "Closed" },
              ],
            },
            {
              type: "select",
              name: "kind",
              label: "Kind",
              options: [
                { value: "all", label: "All kinds" },
                { value: "supplier", label: "Suppliers" },
                { value: "facility", label: "Facilities" },
                { value: "part", label: "Parts" },
                { value: "material", label: "Materials" },
                { value: "lane", label: "Lanes" },
              ],
            },
            {
              type: "select",
              name: "priority",
              label: "Priority",
              options: [
                { value: "all", label: "All priorities" },
                { value: "high", label: "High" },
                { value: "med", label: "Medium" },
                { value: "low", label: "Low" },
              ],
            },
            {
              type: "select",
              name: "sort",
              label: "Sort by",
              options: [
                { value: "recent", label: "Most recent" },
                { value: "priority", label: "Priority" },
                { value: "status", label: "Status" },
              ],
            },
          ]}
        />
      </div>

      {needs.length === 0 ? (
        <EmptyState
          title="No needs match these filters"
          description="Try clearing the filters, or create a new need to start brokering."
          action={
            <Link href="/needs/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> New need
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {needs.map((n) => (
            <Link
              key={n.id}
              href={`/needs/${n.id}`}
              className="card group flex flex-col px-4 py-4 transition-colors hover:bg-[#f1f4f7]/55"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium leading-snug text-ink">{n.title}</h3>
                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
              {n.description ? (
                <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-3">
                  {n.description}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone={needStatusBadge(n.status).tone}>
                  {needStatusBadge(n.status).label}
                </Badge>
                <Badge tone="neutral">{n.kind}</Badge>
                <Badge tone={priorityBadge(n.priority).tone}>
                  {priorityBadge(n.priority).label}
                </Badge>
                {n.material_tag ? (
                  <Badge tone="accent">{n.material_tag}</Badge>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-rule pt-2.5 text-[11px] text-ink-3">
                <span>{n.requester_org_name || "Unassigned"}</span>
                <span>
                  {n.path_count} path{n.path_count === 1 ? "" : "s"} ·{" "}
                  {timeAgo(n.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
