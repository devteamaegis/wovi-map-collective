import "server-only";
import { getDb } from "../db";
import type { Outcome, OutcomeResult } from "../types";
import { nowIso } from "./util";
import { getEdge } from "./edges";

import * as rc from "../recompute.mjs";

export interface OutcomeInput {
  path_id: number | null;
  edge_id: number | null;
  result: OutcomeResult;
  note?: string | null;
}

// Record an outcome that compounds the graph. The confidence_delta stored is
// the actual measured change in the touched edge's confidence (before vs after
// recompute), so the UI can show how much this outcome moved the score.
export function addOutcome(input: OutcomeInput): number {
  const db = getDb();
  const now = nowIso();

  const before = input.edge_id
    ? (getEdge(input.edge_id)?.confidence ?? 0)
    : 0;

  const info = db
    .prepare(
      `INSERT INTO outcomes (path_id,edge_id,result,confidence_delta,note,created_at)
       VALUES (?,?,?,0,?,?)`
    )
    .run(input.path_id, input.edge_id, input.result, input.note ?? null, now);
  const id = Number(info.lastInsertRowid);

  if (input.edge_id) {
    // Measure the outcome's OWN effect first (against the existing recency
    // anchor) so the stored delta isn't inflated by decay recovery...
    rc.recomputeEdge(db, input.edge_id, nowIso());
    const after = getEdge(input.edge_id)?.confidence ?? 0;
    const delta = after - before;
    db.prepare("UPDATE outcomes SET confidence_delta = ? WHERE id = ?").run(
      delta,
      id
    );
    // ...then freshen the recency anchor (an outcome is a confirmation) and
    // persist the refreshed score + every path through this edge.
    db.prepare("UPDATE edges SET last_confirmed_at = ? WHERE id = ?").run(
      now,
      input.edge_id
    );
    rc.recomputeEdge(db, input.edge_id, nowIso());
    rc.recomputePathsForEdge(db, input.edge_id, nowIso());
  }
  if (input.path_id) {
    rc.recomputePath(db, input.path_id, nowIso());
  }
  return id;
}

export interface OutcomeWithContext extends Outcome {
  edge_kind: string | null;
}

export function recentOutcomes(limit = 8): OutcomeWithContext[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT oc.*, e.kind AS edge_kind
       FROM outcomes oc LEFT JOIN edges e ON e.id = oc.edge_id
       ORDER BY oc.created_at DESC LIMIT ?`
    )
    .all(limit) as OutcomeWithContext[];
}
