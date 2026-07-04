// DB-aware confidence recompute. Gathers an edge's signals from outreach +
// outcomes, runs the pure Section-6 math, and writes results back. Shared by
// the seed script and the live app so seeded scores == runtime scores.
import { computeEdgeConfidence, computePathConfidence } from "./confidence.mjs";

const POSITIVE_OUTREACH = new Set(["interested", "consented"]);
const POSITIVE_OUTCOME = new Set(["consented_intro", "sourced"]);
const REFUSAL_OUTREACH = new Set(["refused"]);
const REFUSAL_OUTCOME = new Set(["declined", "dead_end"]);

/**
 * Build the confidence signals for one edge row from its evidence.
 * @param {import('better-sqlite3').Database} db
 * @param {{id:number,kind:string,consent_status:string,first_seen_at:string,last_confirmed_at:string|null}} edge
 */
export function edgeSignals(db, edge) {
  const outreach = db
    .prepare("SELECT outcome FROM outreach WHERE edge_id = ?")
    .all(edge.id);
  const outcomes = db
    .prepare("SELECT result FROM outcomes WHERE edge_id = ?")
    .all(edge.id);

  let positives = 0;
  let refusals = 0;
  for (const o of outreach) {
    if (o.outcome && POSITIVE_OUTREACH.has(o.outcome)) positives++;
    else if (o.outcome && REFUSAL_OUTREACH.has(o.outcome)) refusals++;
  }
  for (const o of outcomes) {
    if (POSITIVE_OUTCOME.has(o.result)) positives++;
    else if (REFUSAL_OUTCOME.has(o.result)) refusals++;
  }

  return {
    kind: edge.kind,
    consent_status: edge.consent_status,
    positives,
    refusals,
    first_seen_at: edge.first_seen_at,
    last_confirmed_at: edge.last_confirmed_at,
  };
}

/**
 * Compute (without writing) an edge's confidence + full breakdown.
 * @param {import('better-sqlite3').Database} db
 */
export function edgeConfidenceDetail(db, edgeId, nowIso) {
  const edge = db
    .prepare(
      "SELECT id,kind,consent_status,first_seen_at,last_confirmed_at FROM edges WHERE id = ?"
    )
    .get(edgeId);
  if (!edge) return null;
  const signals = edgeSignals(db, edge);
  const result = computeEdgeConfidence(signals, nowIso);
  return { ...result, signals };
}

/** Recompute and persist one edge's confidence. */
export function recomputeEdge(db, edgeId, nowIso) {
  const detail = edgeConfidenceDetail(db, edgeId, nowIso);
  if (!detail) return null;
  db.prepare("UPDATE edges SET confidence = ? WHERE id = ?").run(
    detail.value,
    edgeId
  );
  return detail;
}

/** Strongest edge connecting two nodes in either direction, or null. */
export function findEdgeBetween(db, aType, aId, bType, bId) {
  const row = db
    .prepare(
      `SELECT * FROM edges WHERE
         (source_type=? AND source_id=? AND target_type=? AND target_id=?)
         OR (source_type=? AND source_id=? AND target_type=? AND target_id=?)
       ORDER BY confidence DESC LIMIT 1`
    )
    .get(aType, aId, bType, bId, bType, bId, aType, aId);
  return row || null;
}

/** Recompute and persist a path's confidence (product of hop-edge confidence). */
export function recomputePath(db, pathId, nowIso) {
  const hops = db
    .prepare(
      "SELECT node_type,node_id,position FROM path_hops WHERE path_id=? ORDER BY position"
    )
    .all(pathId);
  const confs = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i];
    const b = hops[i + 1];
    const e = findEdgeBetween(db, a.node_type, a.node_id, b.node_type, b.node_id);
    confs.push(e ? e.confidence : 0);
  }
  const value = computePathConfidence(confs);
  db.prepare("UPDATE paths SET confidence = ?, updated_at = ? WHERE id = ?").run(
    value,
    nowIso,
    pathId
  );
  return { value, hopConfidences: confs };
}

/**
 * Recompute every path that touches an edge's endpoints — so an outreach/outcome
 * on a shared edge updates ALL paths through it, not just the event's own path.
 */
export function recomputePathsForEdge(db, edgeId, nowIso) {
  const e = db
    .prepare(
      "SELECT source_type,source_id,target_type,target_id FROM edges WHERE id = ?"
    )
    .get(edgeId);
  if (!e) return;
  const rows = db
    .prepare(
      `SELECT DISTINCT path_id FROM path_hops
       WHERE (node_type=? AND node_id=?) OR (node_type=? AND node_id=?)`
    )
    .all(e.source_type, e.source_id, e.target_type, e.target_id);
  for (const r of rows) recomputePath(db, r.path_id, nowIso);
}

/** Recompute every edge, then every path. */
export function recomputeAll(db, nowIso) {
  const edges = db.prepare("SELECT id FROM edges").all();
  for (const e of edges) recomputeEdge(db, e.id, nowIso);
  const paths = db.prepare("SELECT id FROM paths").all();
  for (const p of paths) recomputePath(db, p.id, nowIso);
}
