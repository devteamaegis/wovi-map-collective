import "server-only";
import { getDb } from "../db";
import type { Edge, EdgeKind, ConsentStatus, NodeType, OrgKind } from "../types";
import { nodeKey } from "../types";
import { parseOrg } from "./util";

export interface GraphNode {
  key: string;
  type: NodeType;
  id: number;
  label: string;
  sublabel: string | null;
  nodeKind: OrgKind | "person";
  region: string | null;
  country: string | null;
  materials: string[];
  capabilities: string[];
  degree: number;
}

export interface GraphLink {
  id: number;
  source: string;
  target: string;
  kind: EdgeKind;
  confidence: number;
  consent_status: ConsentStatus;
  provenance: string | null;
  evidence_note: string | null;
  sourceLabel: string;
  targetLabel: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function graphData(): GraphData {
  const db = getDb();
  const orgs = (db.prepare("SELECT * FROM organizations").all() as any[]).map(
    parseOrg
  );
  const people = db
    .prepare(
      `SELECT p.*, o.name AS org_name, o.region AS org_region, o.country AS org_country
       FROM people p LEFT JOIN organizations o ON o.id = p.org_id`
    )
    .all() as any[];
  const edges = db.prepare("SELECT * FROM edges").all() as Edge[];

  const nodes: GraphNode[] = [];
  const byKey = new Map<string, GraphNode>();

  for (const o of orgs) {
    const n: GraphNode = {
      key: nodeKey("org", o.id),
      type: "org",
      id: o.id,
      label: o.name,
      sublabel: [o.country, o.region].filter(Boolean).join(" · ") || null,
      nodeKind: o.kind,
      region: o.region,
      country: o.country,
      materials: o.materials,
      capabilities: o.capabilities,
      degree: 0,
    };
    nodes.push(n);
    byKey.set(n.key, n);
  }
  for (const p of people) {
    const n: GraphNode = {
      key: nodeKey("person", p.id),
      type: "person",
      id: p.id,
      label: p.name,
      sublabel:
        [p.title, p.org_name].filter(Boolean).join(" · ") || p.org_name || null,
      nodeKind: "person",
      region: p.org_region ?? null,
      country: p.org_country ?? null,
      materials: [],
      capabilities: [],
      degree: 0,
    };
    nodes.push(n);
    byKey.set(n.key, n);
  }

  const links: GraphLink[] = [];
  for (const e of edges) {
    const sKey = nodeKey(e.source_type, e.source_id);
    const tKey = nodeKey(e.target_type, e.target_id);
    const s = byKey.get(sKey);
    const t = byKey.get(tKey);
    if (!s || !t) continue;
    s.degree += 1;
    t.degree += 1;
    links.push({
      id: e.id,
      source: sKey,
      target: tKey,
      kind: e.kind,
      confidence: e.confidence,
      consent_status: e.consent_status,
      provenance: e.provenance,
      evidence_note: e.evidence_note,
      sourceLabel: s.label,
      targetLabel: t.label,
    });
  }

  return { nodes, links };
}

// A node plus its direct (1-hop) neighbourhood — used for directory mini-graphs.
export function neighborhoodGraph(type: NodeType, id: number): GraphData {
  const full = graphData();
  const centerKey = nodeKey(type, id);
  const neighborKeys = new Set<string>([centerKey]);
  for (const l of full.links) {
    if (l.source === centerKey) neighborKeys.add(l.target);
    if (l.target === centerKey) neighborKeys.add(l.source);
  }
  const nodes = full.nodes.filter((n) => neighborKeys.has(n.key));
  const links = full.links.filter(
    (l) => neighborKeys.has(l.source) && neighborKeys.has(l.target)
  );
  return { nodes, links };
}
