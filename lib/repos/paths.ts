import "server-only";
import { getDb } from "../db";
import type {
  Path,
  PathHop,
  PathStatus,
  NodeType,
  Outreach,
  Consent,
  Outcome,
} from "../types";
import { nowIso, resolveNode, NodeLabel } from "./util";

import * as rc from "../recompute.mjs";

export function getPath(id: number): Path | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM paths WHERE id = ?").get(id) as
    | Path
    | undefined;
  return r ?? null;
}

export interface PathHopResolved extends PathHop {
  node: NodeLabel | null;
}

export function pathHops(pathId: number): PathHopResolved[] {
  const db = getDb();
  const hops = db
    .prepare("SELECT * FROM path_hops WHERE path_id = ? ORDER BY position")
    .all(pathId) as PathHop[];
  return hops.map((h) => ({ ...h, node: resolveNode(h.node_type, h.node_id) }));
}

export interface CreatePathInput {
  need_id: number;
  target_org_id: number | null;
  connector_person_id: number | null;
  rationale: string | null;
  status?: PathStatus;
  hops: { type: NodeType; id: number }[];
}

export function createPath(input: CreatePathInput): number {
  const db = getDb();
  const now = nowIso();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO paths (need_id,target_org_id,connector_person_id,rationale,status,confidence,created_at,updated_at)
         VALUES (?,?,?,?,?,0,?,?)`
      )
      .run(
        input.need_id,
        input.target_org_id,
        input.connector_person_id,
        input.rationale,
        input.status ?? "proposed",
        now,
        now
      );
    const pid = Number(info.lastInsertRowid);
    input.hops.forEach((h, i) => {
      db.prepare(
        "INSERT INTO path_hops (path_id,position,node_type,node_id) VALUES (?,?,?,?)"
      ).run(pid, i, h.type, h.id);
    });
    rc.recomputePath(db, pid, nowIso());
    return pid;
  });
  return tx();
}

export function setPathStatus(id: number, status: PathStatus): void {
  const db = getDb();
  db.prepare("UPDATE paths SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    nowIso(),
    id
  );
}

export function recomputePathConfidence(id: number): void {
  const db = getDb();
  rc.recomputePath(db, id, nowIso());
}

export function pathOutreach(pathId: number): Outreach[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM outreach WHERE path_id = ? ORDER BY occurred_at DESC")
    .all(pathId) as Outreach[];
}

export function pathConsents(pathId: number): Consent[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM consents WHERE path_id = ? ORDER BY side")
    .all(pathId) as Consent[];
}

export function pathOutcomes(pathId: number): Outcome[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM outcomes WHERE path_id = ? ORDER BY created_at DESC")
    .all(pathId) as Outcome[];
}

// The hop-edge confidence chain that produces a path's overall confidence.
export function pathEdgeChain(pathId: number): {
  fromLabel: string;
  toLabel: string;
  confidence: number;
  edgeId: number | null;
}[] {
  const db = getDb();
  const hops = pathHops(pathId);
  const chain: {
    fromLabel: string;
    toLabel: string;
    confidence: number;
    edgeId: number | null;
  }[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const a = hops[i];
    const b = hops[i + 1];
    const edge = rc.findEdgeBetween(
      db,
      a.node_type,
      a.node_id,
      b.node_type,
      b.node_id
    );
    chain.push({
      fromLabel: a.node?.label ?? `${a.node_type}#${a.node_id}`,
      toLabel: b.node?.label ?? `${b.node_type}#${b.node_id}`,
      confidence: edge ? edge.confidence : 0,
      edgeId: edge ? edge.id : null,
    });
  }
  return chain;
}
