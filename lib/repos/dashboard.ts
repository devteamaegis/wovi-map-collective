import "server-only";
import { getDb } from "../db";

export interface DashboardStats {
  openNeeds: number;
  pathsInProgress: number;
  awaitingDoubleOptIn: number;
  edges: number;
  avgConfidence: number;
}

export function dashboardStats(): DashboardStats {
  const db = getDb();
  const openNeeds = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM needs WHERE status IN ('open','brokering')"
      )
      .get() as { c: number }
  ).c;
  const pathsInProgress = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM paths WHERE status IN ('proposed','outreach','awaiting_consent')"
      )
      .get() as { c: number }
  ).c;
  const edges = (
    db.prepare("SELECT COUNT(*) AS c FROM edges").get() as { c: number }
  ).c;
  const avg = (
    db.prepare("SELECT AVG(confidence) AS a FROM edges").get() as {
      a: number | null;
    }
  ).a;

  return {
    openNeeds,
    pathsInProgress,
    awaitingDoubleOptIn: 0, // filled by caller via pendingDoubleOptIns().length
    edges,
    avgConfidence: avg == null ? 0 : Math.round(avg),
  };
}

export interface NeedSummary {
  id: number;
  title: string;
  kind: string;
  status: string;
  priority: string;
  material_tag: string | null;
  target_region: string | null;
  requester_org_name: string | null;
  path_count: number;
}

// "Needs that need you": open / brokering, highest priority first.
export function needsThatNeedYou(limit = 6): NeedSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.kind, n.status, n.priority, n.material_tag, n.target_region,
              o.name AS requester_org_name,
              (SELECT COUNT(*) FROM paths WHERE need_id = n.id AND status NOT IN ('dead','declined')) AS path_count
       FROM needs n LEFT JOIN organizations o ON o.id = n.requester_org_id
       WHERE n.status IN ('open','brokering')
       ORDER BY CASE n.priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END,
                n.created_at DESC
       LIMIT ?`
    )
    .all(limit) as NeedSummary[];
  return rows;
}

export interface StrengthenedItem {
  id: number;
  result: string;
  confidence_delta: number;
  note: string | null;
  created_at: string;
  edge_label: string | null;
  edge_kind: string | null;
}

// "Recently strengthened": latest positive outcomes with their edge.
export function recentlyStrengthened(limit = 6): StrengthenedItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT oc.id, oc.result, oc.confidence_delta, oc.note, oc.created_at,
              e.kind AS edge_kind,
              e.source_type AS st, e.source_id AS si, e.target_type AS tt, e.target_id AS ti
       FROM outcomes oc LEFT JOIN edges e ON e.id = oc.edge_id
       WHERE oc.result IN ('consented_intro','sourced')
       ORDER BY oc.created_at DESC LIMIT ?`
    )
    .all(limit) as any[];

  const label = (type: string, id: number): string => {
    if (type === "org") {
      const o = db
        .prepare("SELECT name FROM organizations WHERE id = ?")
        .get(id) as { name: string } | undefined;
      return o?.name ?? "?";
    }
    const p = db.prepare("SELECT name FROM people WHERE id = ?").get(id) as
      | { name: string }
      | undefined;
    return p?.name ?? "?";
  };

  return rows.map((r) => ({
    id: r.id,
    result: r.result,
    confidence_delta: r.confidence_delta,
    note: r.note,
    created_at: r.created_at,
    edge_kind: r.edge_kind,
    edge_label: r.st ? `${label(r.st, r.si)} ↔ ${label(r.tt, r.ti)}` : null,
  }));
}
