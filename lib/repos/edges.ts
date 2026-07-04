import "server-only";
import { getDb } from "../db";
import type {
  Edge,
  EdgeKind,
  ConsentStatus,
  NodeType,
  Outreach,
  Consent,
  Outcome,
} from "../types";
import { nowIso } from "./util";
import type { ConfidenceTerm } from "../confidence";

import * as rc from "../recompute.mjs";

export function getEdge(id: number): Edge | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM edges WHERE id = ?").get(id) as
    | Edge
    | undefined;
  return r ?? null;
}

export function listEdges(): Edge[] {
  const db = getDb();
  return db.prepare("SELECT * FROM edges ORDER BY confidence DESC").all() as Edge[];
}

export interface EdgeInput {
  source_type: NodeType;
  source_id: number;
  target_type: NodeType;
  target_id: number;
  kind: EdgeKind;
  consent_status?: ConsentStatus;
  provenance?: string | null;
  evidence_note?: string | null;
}

export function createEdge(input: EdgeInput): number {
  const db = getDb();
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO edges (source_type,source_id,target_type,target_id,kind,confidence,consent_status,provenance,evidence_note,first_seen_at,last_confirmed_at)
       VALUES (?,?,?,?,?,0,?,?,?,?,?)`
    )
    .run(
      input.source_type,
      input.source_id,
      input.target_type,
      input.target_id,
      input.kind,
      input.consent_status ?? "none",
      input.provenance ?? null,
      input.evidence_note ?? null,
      now,
      now
    );
  const id = Number(info.lastInsertRowid);
  rc.recomputeEdge(db, id, nowIso());
  return id;
}

// Find an existing edge between two nodes (any kind/direction) or null.
export function findEdge(
  aType: NodeType,
  aId: number,
  bType: NodeType,
  bId: number
): Edge | null {
  const db = getDb();
  return (rc.findEdgeBetween(db, aType, aId, bType, bId) as Edge | null) ?? null;
}

export interface EdgeConfidenceDetail {
  value: number;
  raw: number;
  breakdown: ConfidenceTerm[];
  signals: {
    kind: EdgeKind;
    consent_status: ConsentStatus;
    positives: number;
    refusals: number;
    first_seen_at: string;
    last_confirmed_at: string | null;
  };
}

export function edgeConfidenceDetail(id: number): EdgeConfidenceDetail | null {
  const db = getDb();
  return rc.edgeConfidenceDetail(db, id, nowIso()) as EdgeConfidenceDetail | null;
}

export function recomputeEdgeConfidence(id: number): void {
  const db = getDb();
  rc.recomputeEdge(db, id, nowIso());
}

export function edgeOutreach(edgeId: number): Outreach[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM outreach WHERE edge_id = ? ORDER BY occurred_at DESC")
    .all(edgeId) as Outreach[];
}

export function edgeConsents(edgeId: number): Consent[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM consents WHERE edge_id = ? ORDER BY created_at DESC")
    .all(edgeId) as Consent[];
}

export function edgeOutcomes(edgeId: number): Outcome[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM outcomes WHERE edge_id = ? ORDER BY created_at DESC")
    .all(edgeId) as Outcome[];
}

// Set consent status on an edge and recompute (used when a path reaches
// double opt-in, or a single side confirms).
export function setEdgeConsent(id: number, status: ConsentStatus): void {
  const db = getDb();
  db.prepare(
    "UPDATE edges SET consent_status = ?, last_confirmed_at = ? WHERE id = ?"
  ).run(status, nowIso(), id);
  rc.recomputeEdge(db, id, nowIso());
}
