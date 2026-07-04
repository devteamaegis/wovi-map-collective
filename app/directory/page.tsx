import Link from "next/link";
import { Plus, MessageCircle, Phone, Mail, Building2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/Page";
import { Filters } from "@/components/Filters";
import { DataTable, Column } from "@/components/DataTable";
import { Badge, orgKindBadge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import {
  listOrgs,
  distinctRegions,
  orgPeople,
} from "@/lib/repos/orgs";
import { listPeople } from "@/lib/repos/people";
import type { Organization, OrgKind } from "@/lib/types";
import type { PersonWithOrg } from "@/lib/repos/people";

export const dynamic = "force-dynamic";

function Tabs({ tab }: { tab: string }) {
  const items = [
    { key: "orgs", label: "Organizations" },
    { key: "people", label: "People" },
  ];
  return (
    <div className="mb-5 inline-flex rounded-lg border border-rule bg-white p-1">
      {items.map((it) => (
        <Link
          key={it.key}
          href={`/directory?tab=${it.key}`}
          className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            tab === it.key
              ? "bg-navy text-white"
              : "text-ink-2 hover:bg-paper-2"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "people" ? "people" : "orgs";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Directory"
        title="Who is in the graph"
        description="Every organization and person Wovi knows — searchable, filterable, and fully editable. The map is only as good as what the broker captures here."
        actions={
          <div className="flex gap-2">
            <Link href="/directory/org/new" className="btn btn-sm">
              <Plus size={14} /> Organization
            </Link>
            <Link href="/directory/person/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> Person
            </Link>
          </div>
        }
      />

      <Tabs tab={tab} />

      {tab === "orgs" ? (
        <OrgsTab sp={sp} />
      ) : (
        <PeopleTab sp={sp} />
      )}
    </PageContainer>
  );
}

function OrgsTab({ sp }: { sp: { [k: string]: string | undefined } }) {
  const orgs = listOrgs({
    q: sp.q,
    kind: (sp.kind as OrgKind) || "all",
    region: sp.region || "all",
  });
  const regions = distinctRegions();

  const columns: Column<Organization>[] = [
    {
      key: "name",
      header: "Name",
      render: (o) => (
        <div>
          <div className="font-medium text-ink">{o.name}</div>
          <div className="text-[11px] text-ink-3">
            {[o.country, o.region].filter(Boolean).join(" · ")}
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (o) => (
        <Badge tone={orgKindBadge(o.kind).tone}>{orgKindBadge(o.kind).label}</Badge>
      ),
    },
    {
      key: "materials",
      header: "Materials & capabilities",
      render: (o) => (
        <div className="flex flex-wrap gap-1">
          {[...o.materials, ...o.capabilities].slice(0, 4).map((m) => (
            <span
              key={m}
              className="rounded bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-2"
            >
              {m}
            </span>
          ))}
          {o.materials.length + o.capabilities.length > 4 ? (
            <span className="text-[11px] text-ink-3">
              +{o.materials.length + o.capabilities.length - 4}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "people",
      header: "People",
      className: "text-right",
      headerClassName: "text-right",
      render: (o) => (
        <span className="mono text-ink-2">{orgPeople(o.id).length}</span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4">
        <Filters
          fields={[
            { type: "search", name: "q", label: "Search", placeholder: "Search organizations…" },
            {
              type: "select",
              name: "kind",
              label: "Kind",
              options: [
                { value: "all", label: "All kinds" },
                { value: "buyer", label: "Buyers" },
                { value: "supplier", label: "Suppliers" },
                { value: "broker", label: "Brokers" },
                { value: "facility", label: "Facilities" },
              ],
            },
            {
              type: "select",
              name: "region",
              label: "Region",
              options: [
                { value: "all", label: "All regions" },
                ...regions.map((r) => ({ value: r, label: r })),
              ],
            },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={orgs}
        rowHref={(o) => `/directory/org/${o.id}`}
        empty={
          <EmptyState
            title="No organizations match"
            description="Adjust the filters or add a new organization."
          />
        }
      />
    </>
  );
}

function ChannelIcons({ p }: { p: PersonWithOrg }) {
  return (
    <div className="flex items-center gap-1.5 text-ink-3">
      {p.whatsapp ? <MessageCircle size={14} aria-label="WhatsApp" /> : null}
      {p.wechat ? (
        <span className="text-[10px] font-semibold" title="WeChat">
          微
        </span>
      ) : null}
      {p.phone ? <Phone size={14} aria-label="Phone" /> : null}
      {p.email ? <Mail size={14} aria-label="Email" /> : null}
    </div>
  );
}

function PeopleTab({ sp }: { sp: { [k: string]: string | undefined } }) {
  const people = listPeople({
    q: sp.q,
    orgId: sp.org ? Number(sp.org) : "all",
    channel: (sp.channel as any) || "all",
  });
  const orgs = listOrgs();

  const columns: Column<PersonWithOrg>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div>
          <div className="font-medium text-ink">{p.name}</div>
          <div className="text-[11px] text-ink-3">{p.title || "—"}</div>
        </div>
      ),
    },
    {
      key: "org",
      header: "Organization",
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          {p.org_name ? <Building2 size={13} className="text-ink-3" /> : null}
          {p.org_name || "Unaffiliated"}
        </span>
      ),
    },
    {
      key: "channels",
      header: "Channels",
      render: (p) => <ChannelIcons p={p} />,
    },
  ];

  return (
    <>
      <div className="mb-4">
        <Filters
          fields={[
            { type: "search", name: "q", label: "Search", placeholder: "Search people…" },
            {
              type: "select",
              name: "org",
              label: "Organization",
              options: [
                { value: "all", label: "All organizations" },
                ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
              ],
            },
            {
              type: "select",
              name: "channel",
              label: "Channel",
              options: [
                { value: "all", label: "Any channel" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "wechat", label: "WeChat" },
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
              ],
            },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={people}
        rowHref={(p) => `/directory/person/${p.id}`}
        empty={
          <EmptyState
            title="No people match"
            description="Adjust the filters or add a new person."
          />
        }
      />
    </>
  );
}
