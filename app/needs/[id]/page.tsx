import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import {
  Badge,
  needStatusBadge,
  priorityBadge,
} from "@/components/Badge";
import { NeedWorkspace } from "@/components/needs/NeedWorkspace";
import { getNeed, needPaths } from "@/lib/repos/needs";
import {
  pathHops,
  pathEdgeChain,
  pathOutreach,
  pathConsents,
  pathOutcomes,
} from "@/lib/repos/paths";
import { listPeople } from "@/lib/repos/people";
import { findPaths } from "@/lib/pathfinder";
import { resolveNode } from "@/lib/repos/util";
import type { NodeType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TARGET_KINDS: Record<string, string[]> = {
  supplier: ["supplier"],
  material: ["supplier"],
  part: ["supplier"],
  facility: ["facility"],
  lane: ["facility", "supplier"],
};

export default async function NeedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const need = getNeed(id);
  if (!need) notFound();

  const paths = needPaths(id);
  const existingTargets = paths
    .map((p) => p.target_org_id)
    .filter((x): x is number => x != null);

  // Build the active-path payloads.
  const pathPayloads = paths.map((p) => ({
    id: p.id,
    status: p.status,
    confidence: p.confidence,
    rationale: p.rationale,
    target_org_id: p.target_org_id,
    connector_person_id: p.connector_person_id,
    hops: pathHops(p.id).map((h) => ({
      type: h.node_type,
      id: h.node_id,
      label: h.node?.label ?? `${h.node_type}#${h.node_id}`,
      sublabel: h.node?.sublabel ?? null,
    })),
    edgeChain: pathEdgeChain(p.id),
    outreach: pathOutreach(p.id).map((o) => ({
      ...o,
      person_name:
        o.person_id != null
          ? resolveNode("person", o.person_id)?.label ?? null
          : null,
    })),
    consents: pathConsents(p.id).map((c) => ({
      ...c,
      person_name:
        c.person_id != null
          ? resolveNode("person", c.person_id)?.label ?? null
          : null,
    })),
    outcomes: pathOutcomes(p.id),
  }));

  // Suggested paths from the pathfinder.
  const requesterNode: { type: NodeType; id: number } | null =
    need.requester_person_id != null
      ? { type: "person", id: need.requester_person_id }
      : need.requester_org_id != null
        ? { type: "org", id: need.requester_org_id }
        : null;

  let suggestions: any[] = [];
  if (requesterNode) {
    const found = findPaths(requesterNode, {
      materialTag: need.material_tag,
      region: need.target_region,
      excludeTargetIds: existingTargets,
      targetKinds: TARGET_KINDS[need.kind] || ["supplier"],
      limit: 5,
    });
    suggestions = found.map((f) => {
      const hops = f.nodes.map((n) => {
        const label = resolveNode(n.type, n.id);
        return {
          type: n.type,
          id: n.id,
          label: label?.label ?? `${n.type}#${n.id}`,
          sublabel: label?.sublabel ?? null,
        };
      });
      // Connector = first person hop between source and target.
      const connector =
        hops.slice(1, -1).find((h) => h.type === "person") || null;
      const targetLabel = resolveNode("org", f.targetOrgId);
      const chain = f.edges.map((e, i) => ({
        fromLabel: hops[i]?.label ?? "?",
        toLabel: hops[i + 1]?.label ?? "?",
        confidence: e.confidence,
        kind: e.kind,
        consent: e.consent_status,
      }));
      const rationale = connector
        ? `${hops[0].label} → ${connector.label} → ${targetLabel?.label}. Best trusted route by confidence.`
        : `${hops[0].label} → ${targetLabel?.label}. Direct trusted route.`;
      return {
        targetOrgId: f.targetOrgId,
        targetOrgName: targetLabel?.label ?? "Unknown",
        connectorPersonId: connector?.id ?? null,
        connectorName: connector?.label ?? null,
        pathConfidence: f.pathConfidence,
        hopCount: f.hopCount,
        hops,
        edgeChain: chain,
        rationale,
      };
    });
  }

  const people = listPeople().map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    org_name: p.org_name,
  }));

  return (
    <PageContainer>
      <Link
        href="/needs"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> All needs
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-3">
          <Eyebrow>Brokering workspace · {need.kind}</Eyebrow>
          <h1 className="serif text-[26px] leading-tight text-ink">
            {need.title}
          </h1>
          {need.description ? (
            <p className="text-sm leading-relaxed text-ink-2">
              {need.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge tone={needStatusBadge(need.status).tone}>
              {needStatusBadge(need.status).label}
            </Badge>
            <Badge tone={priorityBadge(need.priority).tone}>
              {priorityBadge(need.priority).label} priority
            </Badge>
            {need.material_tag ? (
              <Badge tone="accent">{need.material_tag}</Badge>
            ) : null}
            {need.target_region ? (
              <Badge tone="neutral">{need.target_region}</Badge>
            ) : null}
            {need.requester_org_name ? (
              <span className="text-[12px] text-ink-3">
                · {need.requester_org_name}
                {need.requester_person_name
                  ? ` · ${need.requester_person_name}`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <NeedWorkspace
        need={{
          id: need.id,
          status: need.status,
          requester_org_id: need.requester_org_id,
          requester_person_id: need.requester_person_id,
          material_tag: need.material_tag,
          target_region: need.target_region,
        }}
        suggestions={suggestions}
        paths={pathPayloads}
        people={people}
      />
    </PageContainer>
  );
}
