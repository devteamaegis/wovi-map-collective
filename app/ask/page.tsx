import { PageContainer, PageHeader } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { Card } from "@/components/Card";
import { AskForm } from "@/components/ask/AskForm";
import { BrokerThisButton } from "@/components/ask/BrokerThisButton";
import { EmptyState } from "@/components/EmptyState";
import {
  Badge,
  consentBadge,
  edgeKindBadge,
} from "@/components/Badge";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { ArrowRight, Building2, User } from "lucide-react";
import { listOrgs, distinctRegions } from "@/lib/repos/orgs";
import { listPeople } from "@/lib/repos/people";
import { findPaths } from "@/lib/pathfinder";
import { resolveNode } from "@/lib/repos/util";
import type { NodeType, NeedKind } from "@/lib/types";
import type { BrokerThisInput } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask the map" };

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const orgs = listOrgs();
  const people = listPeople();
  const regions = distinctRegions();
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const buyers = orgs.filter((o) => o.kind === "buyer");
  const defaultFromId = buyers[0]?.id ?? orgs[0]?.id ?? 0;

  const fromType = (sp.fromType as NodeType) || "org";
  const fromId = sp.fromId ? Number(sp.fromId) : defaultFromId;
  const capability = sp.capability || "";
  const material = sp.material || "";
  const region = sp.region || "";
  const consentedOnly = sp.consented === "1";
  const tag = material || capability || null;

  const source: { type: NodeType; id: number } = {
    type: fromType === "person" ? "person" : "org",
    id: fromId,
  };
  const sourceLabel = resolveNode(source.type, source.id);

  const found = findPaths(source, {
    materialTag: tag,
    region: region || null,
    consentedOnly,
    limit: 5,
  });

  const results = found.map((f) => {
    const hops = f.nodes.map((n) => {
      const lbl = resolveNode(n.type, n.id);
      return {
        type: n.type,
        id: n.id,
        label: lbl?.label ?? `${n.type}#${n.id}`,
      };
    });
    const connector = hops.slice(1, -1).find((h) => h.type === "person") || null;
    const targetOrg = orgById.get(f.targetOrgId);
    const targetName = targetOrg?.name ?? "Unknown";
    const targetKind = targetOrg?.kind === "facility" ? "facility" : "supplier";
    const tagLabel = material || capability || "supply";
    const rationale = connector
      ? `${hops[0].label} → ${connector.label} → ${targetName}. Highest-confidence trusted route.`
      : `${hops[0].label} → ${targetName}. Direct trusted route.`;

    const requester_org_id =
      source.type === "org"
        ? source.id
        : people.find((p) => p.id === source.id)?.org_id ?? null;
    const requester_person_id = source.type === "person" ? source.id : null;

    const brokerInput: BrokerThisInput = {
      title: `Source ${tagLabel} from ${targetName}`,
      kind: targetKind as NeedKind,
      description: `Trusted route surfaced by Ask the Map. ${rationale}`,
      material_tag: tag,
      target_region: region || null,
      requester_org_id,
      requester_person_id,
      priority: "med",
      target_org_id: f.targetOrgId,
      connector_person_id: connector?.id ?? null,
      rationale,
      hops: f.nodes.map((n) => ({ type: n.type, id: n.id })),
    };

    return {
      targetName,
      pathConfidence: f.pathConfidence,
      hopCount: f.hopCount,
      hops,
      edges: f.edges.map((e, i) => ({
        fromLabel: hops[i]?.label ?? "?",
        toLabel: hops[i + 1]?.label ?? "?",
        confidence: e.confidence,
        kind: e.kind,
        consent: e.consent_status,
      })),
      brokerInput,
    };
  });

  const fromOptions = [
    ...orgs
      .slice()
      .sort((a, b) => (a.kind === "buyer" ? -1 : 1))
      .map((o) => ({
        value: `org:${o.id}`,
        label: `${o.name} (${o.kind})`,
        group: "Organizations" as const,
      })),
    ...people.map((p) => ({
      value: `person:${p.id}`,
      label: `${p.name}${p.org_name ? " · " + p.org_name : ""}`,
      group: "People" as const,
    })),
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Ask the map"
        title="Who can get me this — and through whom?"
        description="The pathfinder walks the relationship graph from where you are to the supplier or facility you need, returning the single most promising trusted routes before any transaction."
      />

      <Card className="mb-6 px-6 py-5">
        <AskForm
          options={fromOptions}
          regions={regions}
          defaults={{
            from: `${source.type}:${source.id}`,
            capability,
            material,
            region,
            consentedOnly,
          }}
        />
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Trusted paths from {sourceLabel?.label ?? "source"}</Eyebrow>
        <span className="text-[12px] text-ink-3">
          ranked by path confidence, then fewest hops
        </span>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No trusted path found"
          description="No route from the chosen source reaches a matching supplier under these filters. Try a different source, loosen the region, or uncheck consented-only."
        />
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={i} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-[13px] font-medium text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{r.targetName}</p>
                    <p className="text-[12px] text-ink-3">
                      {r.hopCount} hop{r.hopCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="serif text-xl tabular-nums">
                      {r.pathConfidence}
                    </span>
                    <span className="ml-1 text-[11px] text-ink-3">conf</span>
                  </div>
                  <BrokerThisButton input={r.brokerInput} />
                </div>
              </div>

              {/* Hop chain with per-edge confidence + consent */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {r.hops.map((h, hi) => (
                  <span key={hi} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-white px-2.5 py-1.5">
                      {h.type === "org" ? (
                        <Building2 size={13} className="text-ink-3" />
                      ) : (
                        <User size={13} className="text-ink-3" />
                      )}
                      <span className="text-[13px] font-medium text-ink">
                        {h.label}
                      </span>
                    </span>
                    {hi < r.hops.length - 1 ? (
                      <span className="flex flex-col items-center px-1">
                        <span className="flex items-center gap-1">
                          <Badge tone={edgeKindBadge(r.edges[hi].kind).tone}>
                            {edgeKindBadge(r.edges[hi].kind).label}
                          </Badge>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span className="mono text-[10px] text-accent">
                            {r.edges[hi].confidence}
                          </span>
                          <ArrowRight size={13} className="text-ink-3" />
                        </span>
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>

              {/* Per-edge consent badges */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <ConfidenceBar value={r.pathConfidence} />
                </div>
                {r.edges.map((e, ei) => (
                  <Badge key={ei} tone={consentBadge(e.consent).tone}>
                    {e.fromLabel.split(" ")[0]} ↔ {e.toLabel.split(" ")[0]}:{" "}
                    {consentBadge(e.consent).label}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
