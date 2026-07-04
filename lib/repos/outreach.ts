import "server-only";
import { getDb } from "../db";
import type { Outreach, Channel, Direction, OutreachOutcome } from "../types";
import { nowIso } from "./util";

import * as rc from "../recompute.mjs";

export interface OutreachInput {
  path_id: number | null;
  edge_id: number | null;
  channel: Channel;
  direction: Direction;
  person_id: number | null;
  summary: string;
  outcome: OutreachOutcome | null;
  occurred_at?: string;
}

// Log an outreach event. If it carries an outcome that touches an edge, the
// edge confidence (and any path using it) is recomputed immediately.
export function addOutreach(input: OutreachInput): number {
  const db = getDb();
  const now = input.occurred_at || nowIso();
  const info = db
    .prepare(
      `INSERT INTO outreach (path_id,edge_id,channel,direction,person_id,summary,outcome,occurred_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      input.path_id,
      input.edge_id,
      input.channel,
      input.direction,
      input.person_id,
      input.summary,
      input.outcome,
      now
    );

  if (input.edge_id) {
    db.prepare("UPDATE edges SET last_confirmed_at = ? WHERE id = ?").run(
      now,
      input.edge_id
    );
    rc.recomputeEdge(db, input.edge_id, nowIso());
    // Update every path through this edge, not just the event's own path.
    rc.recomputePathsForEdge(db, input.edge_id, nowIso());
  }
  if (input.path_id) {
    rc.recomputePath(db, input.path_id, nowIso());
  }
  return Number(info.lastInsertRowid);
}

export interface OutreachWithPerson extends Outreach {
  person_name: string | null;
}

export function recentOutreach(limit = 8): OutreachWithPerson[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.*, p.name AS person_name
       FROM outreach r LEFT JOIN people p ON p.id = r.person_id
       ORDER BY r.occurred_at DESC LIMIT ?`
    )
    .all(limit) as OutreachWithPerson[];
}
