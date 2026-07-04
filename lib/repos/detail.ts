import "server-only";
import { getDb } from "../db";
import type { NodeType, Edge } from "../types";
import { resolveNode, parseOrg } from "./util";
import { edgeConfidenceDetail } from "./edges";

export interface NodeEdgeRow {
  id: number;
  otherType: NodeType;
  otherId: number;
  otherLabel: string;
  kind: string;
  confidence: number;
  consent_status: string;
}

export interface NodeDetail {
  type: NodeType;
  id: number;
  label: string;
  sublabel: string | null;
  nodeKind: string; // org kind or "person"
  profile: { label: string; value: string }[];
  notes: string | null;
  people: { id: number; name: string; title: string | null }[];
  edges: NodeEdgeRow[];
  needs: { id: number; title: string; status: string }[];
  paths: { id: number; need_title: string | null; status: string; confidence: number }[];
}

function edgesForNode(type: NodeType, id: number): NodeEdgeRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM edges WHERE (source_type=? AND source_id=?) OR (target_type=? AND target_id=?)
       ORDER BY confidence DESC`
    )
    .all(type, id, type, id) as Edge[];
  return rows.map((e) => {
    const isSource = e.source_type === type && e.source_id === id;
    const otherType = isSource ? e.target_type : e.source_type;
    const otherId = isSource ? e.target_id : e.source_id;
    const other = resolveNode(otherType, otherId);
    return {
      id: e.id,
      otherType,
      otherId,
      otherLabel: other?.label ?? "?",
      kind: e.kind,
      confidence: e.confidence,
      consent_status: e.consent_status,
    };
  });
}

export function nodeDetail(type: NodeType, id: number): NodeDetail | null {
  const db = getDb();
  const base = resolveNode(type, id);
  if (!base) return null;

  if (type === "org") {
    const o = parseOrg(
      db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as any
    );
    const people = db
      .prepare(
        "SELECT id,name,title FROM people WHERE org_id = ? ORDER BY name COLLATE NOCASE"
      )
      .all(id) as { id: number; name: string; title: string | null }[];
    const needs = db
      .prepare(
        "SELECT id,title,status FROM needs WHERE requester_org_id = ? ORDER BY created_at DESC"
      )
      .all(id) as { id: number; title: string; status: string }[];
    const paths = db
      .prepare(
        `SELECT pa.id, pa.status, pa.confidence, n.title AS need_title
         FROM paths pa LEFT JOIN needs n ON n.id = pa.need_id
         WHERE pa.target_org_id = ? ORDER BY pa.confidence DESC`
      )
      .all(id) as any[];
    return {
      type,
      id,
      label: o.name,
      sublabel: [o.country, o.region].filter(Boolean).join(" · ") || null,
      nodeKind: o.kind,
      profile: [
        { label: "Kind", value: o.kind },
        { label: "Country", value: o.country || "—" },
        { label: "Region", value: o.region || "—" },
        { label: "Materials", value: o.materials.join(", ") || "—" },
        { label: "Capabilities", value: o.capabilities.join(", ") || "—" },
      ],
      notes: o.notes,
      people,
      edges: edgesForNode(type, id),
      needs,
      paths,
    };
  }

  const p = db
    .prepare(
      `SELECT p.*, o.name AS org_name FROM people p LEFT JOIN organizations o ON o.id = p.org_id WHERE p.id = ?`
    )
    .get(id) as any;
  const paths = db
    .prepare(
      `SELECT pa.id, pa.status, pa.confidence, n.title AS need_title
       FROM paths pa LEFT JOIN needs n ON n.id = pa.need_id
       WHERE pa.connector_person_id = ? ORDER BY pa.confidence DESC`
    )
    .all(id) as any[];
  const needs = db
    .prepare(
      "SELECT id,title,status FROM needs WHERE requester_person_id = ? ORDER BY created_at DESC"
    )
    .all(id) as { id: number; title: string; status: string }[];
  return {
    type,
    id,
    label: p.name,
    sublabel: [p.title, p.org_name].filter(Boolean).join(" · ") || null,
    nodeKind: "person",
    profile: [
      { label: "Title", value: p.title || "—" },
      { label: "Organization", value: p.org_name || "—" },
      { label: "WhatsApp", value: p.whatsapp || "—" },
      { label: "WeChat", value: p.wechat || "—" },
      { label: "Phone", value: p.phone || "—" },
      { label: "Email", value: p.email || "—" },
    ],
    notes: p.notes,
    people: [],
    edges: edgesForNode(type, id),
    needs,
    paths,
  };
}

export interface EdgeDetail {
  id: number;
  sourceType: NodeType;
  sourceId: number;
  targetType: NodeType;
  targetId: number;
  sourceLabel: string;
  targetLabel: string;
  kind: string;
  consent_status: string;
  confidence: number;
  provenance: string | null;
  evidence_note: string | null;
  first_seen_at: string;
  last_confirmed_at: string | null;
  breakdown: { label: string; detail: string; value: number }[];
  signals: { positives: number; refusals: number };
  outreach: {
    id: number;
    channel: string;
    direction: string;
    summary: string;
    outcome: string | null;
    person_name: string | null;
    occurred_at: string;
  }[];
  consents: {
    id: number;
    side: string;
    status: string;
    person_name: string | null;
    note: string | null;
    created_at: string;
  }[];
  outcomes: {
    id: number;
    result: string;
    confidence_delta: number;
    note: string | null;
    created_at: string;
  }[];
}

export function edgeDetail(id: number): EdgeDetail | null {
  const db = getDb();
  const e = db.prepare("SELECT * FROM edges WHERE id = ?").get(id) as
    | Edge
    | undefined;
  if (!e) return null;
  const detail = edgeConfidenceDetail(id);
  const src = resolveNode(e.source_type, e.source_id);
  const tgt = resolveNode(e.target_type, e.target_id);

  const outreach = db
    .prepare(
      `SELECT r.id, r.channel, r.direction, r.summary, r.outcome, r.occurred_at, p.name AS person_name
       FROM outreach r LEFT JOIN people p ON p.id = r.person_id
       WHERE r.edge_id = ? ORDER BY r.occurred_at DESC`
    )
    .all(id) as any[];
  const consents = db
    .prepare(
      `SELECT c.id, c.side, c.status, c.note, c.created_at, p.name AS person_name
       FROM consents c LEFT JOIN people p ON p.id = c.person_id
       WHERE c.edge_id = ? ORDER BY c.created_at DESC`
    )
    .all(id) as any[];
  const outcomes = db
    .prepare(
      "SELECT id, result, confidence_delta, note, created_at FROM outcomes WHERE edge_id = ? ORDER BY created_at DESC"
    )
    .all(id) as any[];

  return {
    id: e.id,
    sourceType: e.source_type,
    sourceId: e.source_id,
    targetType: e.target_type,
    targetId: e.target_id,
    sourceLabel: src?.label ?? "?",
    targetLabel: tgt?.label ?? "?",
    kind: e.kind,
    consent_status: e.consent_status,
    confidence: e.confidence,
    provenance: e.provenance,
    evidence_note: e.evidence_note,
    first_seen_at: e.first_seen_at,
    last_confirmed_at: e.last_confirmed_at,
    breakdown: detail?.breakdown ?? [],
    signals: {
      positives: detail?.signals.positives ?? 0,
      refusals: detail?.signals.refusals ?? 0,
    },
    outreach,
    consents,
    outcomes,
  };
}
