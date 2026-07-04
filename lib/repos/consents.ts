import "server-only";
import { getDb } from "../db";
import type {
  Consent,
  ConsentRecordStatus,
  ConsentSide,
  Edge,
} from "../types";
import { nowIso, resolveNode } from "./util";
import { getPath, pathConsents, pathOutcomes, recomputePathConfidence, setPathStatus } from "./paths";
import { getNeed } from "./needs";
import { findEdge, createEdge, setEdgeConsent } from "./edges";
import { addOutcome } from "./outcomes";

export function getConsent(id: number): Consent | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM consents WHERE id = ?").get(id) as
    | Consent
    | undefined;
  return r ?? null;
}

export interface ConsentContext extends Consent {
  person_name: string | null;
  person_org: string | null;
  need_id: number | null;
  need_title: string | null;
  path_status: string | null;
  path_rationale: string | null;
  edge_label: string | null;
  provenance: string | null;
}

export function listConsents(): ConsentContext[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, p.name AS person_name, o.name AS person_org,
              pa.status AS path_status, pa.rationale AS path_rationale,
              pa.need_id AS need_id, n.title AS need_title,
              e.source_type AS e_src_t, e.source_id AS e_src_id,
              e.target_type AS e_tgt_t, e.target_id AS e_tgt_id,
              e.provenance AS provenance
       FROM consents c
       LEFT JOIN people p ON p.id = c.person_id
       LEFT JOIN organizations o ON o.id = p.org_id
       LEFT JOIN paths pa ON pa.id = c.path_id
       LEFT JOIN needs n ON n.id = pa.need_id
       LEFT JOIN edges e ON e.id = c.edge_id
       ORDER BY c.created_at DESC`
    )
    .all() as any[];

  return rows.map((r) => {
    let edge_label: string | null = null;
    if (r.e_src_t) {
      const a = resolveNode(r.e_src_t, r.e_src_id);
      const b = resolveNode(r.e_tgt_t, r.e_tgt_id);
      edge_label = `${a?.label ?? "?"} ↔ ${b?.label ?? "?"}`;
    }
    return {
      id: r.id,
      path_id: r.path_id,
      edge_id: r.edge_id,
      person_id: r.person_id,
      side: r.side,
      status: r.status,
      note: r.note,
      created_at: r.created_at,
      decided_at: r.decided_at,
      person_name: r.person_name,
      person_org: r.person_org,
      need_id: r.need_id,
      need_title: r.need_title,
      path_status: r.path_status,
      path_rationale: r.path_rationale,
      edge_label,
      provenance: r.provenance,
    } as ConsentContext;
  });
}

// Paths where exactly one side has granted and the other is still pending —
// the "awaiting double opt-in" set highlighted across the app.
export interface PendingDoubleOptIn {
  path_id: number;
  need_id: number | null;
  need_title: string | null;
  granted_side: ConsentSide;
  waiting_side: ConsentSide;
  waiting_consent_id: number;
  waiting_person_name: string | null;
  rationale: string | null;
}

export function pendingDoubleOptIns(): PendingDoubleOptIn[] {
  const db = getDb();
  const paths = db
    .prepare(
      `SELECT DISTINCT pa.id AS path_id, pa.need_id, pa.rationale, n.title AS need_title
       FROM paths pa
       JOIN consents c ON c.path_id = pa.id
       LEFT JOIN needs n ON n.id = pa.need_id
       WHERE pa.status IN ('awaiting_consent','outreach','proposed')`
    )
    .all() as any[];

  const out: PendingDoubleOptIn[] = [];
  for (const p of paths) {
    const cs = pathConsents(p.path_id);
    const granted = cs.find((c) => c.status === "granted");
    const pending = cs.find((c) => c.status === "pending");
    if (granted && pending && granted.side !== pending.side) {
      const person = resolveNode("person", pending.person_id);
      out.push({
        path_id: p.path_id,
        need_id: p.need_id,
        need_title: p.need_title,
        granted_side: granted.side,
        waiting_side: pending.side,
        waiting_consent_id: pending.id,
        waiting_person_name: person?.label ?? null,
        rationale: p.rationale,
      });
    }
  }
  return out;
}

// Ensure a path has a pending requester + supplier consent record (created the
// first time the broker opens the consent step in the workspace).
export function ensurePathConsents(pathId: number): void {
  const db = getDb();
  const path = getPath(pathId);
  if (!path) return;
  const existing = pathConsents(pathId);
  const need = getNeed(path.need_id);

  const ensure = (side: ConsentSide, personId: number | null) => {
    if (existing.some((c) => c.side === side)) return;
    if (personId == null) return;
    db.prepare(
      `INSERT INTO consents (path_id,edge_id,person_id,side,status,note,created_at,decided_at)
       VALUES (?,?,?,?,'pending',?,?,NULL)`
    ).run(pathId, null, personId, side, null, nowIso());
  };

  // Requester person: the need's requester, else any person at requester org.
  let reqPerson = need?.requester_person_id ?? null;
  if (reqPerson == null && need?.requester_org_id != null) {
    const p = db
      .prepare("SELECT id FROM people WHERE org_id = ? LIMIT 1")
      .get(need.requester_org_id) as { id: number } | undefined;
    reqPerson = p?.id ?? null;
  }
  // Supplier person: a person at the target org, else the connector.
  let supPerson: number | null = null;
  if (path.target_org_id != null) {
    const p = db
      .prepare("SELECT id FROM people WHERE org_id = ? LIMIT 1")
      .get(path.target_org_id) as { id: number } | undefined;
    supPerson = p?.id ?? null;
  }
  if (supPerson == null) supPerson = path.connector_person_id ?? null;

  ensure("requester", reqPerson);
  ensure("supplier", supPerson);
}

export interface ConsentDecisionResult {
  pathReachedDoubleOptIn: boolean;
  newEdgeId: number | null;
}

export function decideConsent(
  id: number,
  status: ConsentRecordStatus,
  note?: string | null
): ConsentDecisionResult {
  const db = getDb();
  const consent = getConsent(id);
  if (!consent) return { pathReachedDoubleOptIn: false, newEdgeId: null };

  const decided = status === "pending" ? null : nowIso();
  db.prepare(
    "UPDATE consents SET status = ?, decided_at = ?, note = COALESCE(?, note) WHERE id = ?"
  ).run(status, decided, note ?? null, id);

  if (consent.path_id == null) {
    return { pathReachedDoubleOptIn: false, newEdgeId: null };
  }
  return resolveConsentEffects(consent.path_id);
}

// Apply the double opt-in rules after a consent changes on a path. Handles both
// reaching double opt-in AND tearing it back down (a side refuses/revokes after
// consent): the brokered edge's consent is downgraded and the path status
// follows the consents — never left stale at "consented".
function resolveConsentEffects(pathId: number): ConsentDecisionResult {
  const db = getDb();
  const path = getPath(pathId);
  if (!path) return { pathReachedDoubleOptIn: false, newEdgeId: null };

  const need = getNeed(path.need_id);
  const reqOrg = need?.requester_org_id ?? null;
  const tgtOrg = path.target_org_id ?? null;
  const brokerEdge =
    reqOrg != null && tgtOrg != null
      ? findEdge("org", reqOrg, "org", tgtOrg)
      : null;

  const cs = pathConsents(pathId);
  const reqGranted = cs.some((c) => c.side === "requester" && c.status === "granted");
  const supGranted = cs.some((c) => c.side === "supplier" && c.status === "granted");
  // A revoke is a withdrawal just like a refusal.
  const anyWithdrawn = cs.some(
    (c) => c.status === "refused" || c.status === "revoked"
  );

  // --- Both sides granted → double opt-in -----------------------------------
  if (reqGranted && supGranted) {
    let edgeId: number | null = brokerEdge ? brokerEdge.id : null;
    if (reqOrg != null && tgtOrg != null) {
      if (edgeId != null) {
        setEdgeConsent(edgeId, "double_opt_in");
      } else {
        edgeId = createEdge({
          source_type: "org",
          source_id: tgtOrg,
          target_type: "org",
          target_id: reqOrg,
          kind: "brokered_intro",
          consent_status: "double_opt_in",
          provenance: "Double opt-in via Wovi broker",
          evidence_note: "Both sides consented to the introduction.",
        });
      }
      db.prepare(
        "UPDATE consents SET edge_id = ? WHERE path_id = ? AND edge_id IS NULL"
      ).run(edgeId, pathId);
    }

    setPathStatus(pathId, "consented");
    const alreadyLogged = pathOutcomes(pathId).some(
      (o) => o.result === "consented_intro"
    );
    if (!alreadyLogged) {
      addOutcome({
        path_id: pathId,
        edge_id: edgeId,
        result: "consented_intro",
        note: "Double opt-in reached — consented introduction made.",
      });
    }
    recomputePathConfidence(pathId);
    return { pathReachedDoubleOptIn: true, newEdgeId: edgeId };
  }

  // --- Not both granted: tear down any previously formed double-opt-in edge ---
  if (brokerEdge && brokerEdge.consent_status === "double_opt_in") {
    setEdgeConsent(
      brokerEdge.id,
      reqGranted || supGranted ? "one_sided" : "none"
    );
  }

  // Fully withdrawn → declined; record the refusal against the edge so the
  // confidence recompute actually applies the penalty.
  if (anyWithdrawn && !reqGranted && !supGranted) {
    setPathStatus(pathId, "declined");
    const alreadyLogged = pathOutcomes(pathId).some(
      (o) => o.result === "declined"
    );
    if (!alreadyLogged) {
      addOutcome({
        path_id: pathId,
        edge_id: brokerEdge ? brokerEdge.id : null,
        result: "declined",
        note: "Introduction declined — consent refused or withdrawn.",
      });
    }
    recomputePathConfidence(pathId);
    return { pathReachedDoubleOptIn: false, newEdgeId: null };
  }

  // One side still granted → awaiting the other's consent again.
  if (reqGranted || supGranted) {
    setPathStatus(pathId, "awaiting_consent");
    recomputePathConfidence(pathId);
    return { pathReachedDoubleOptIn: false, newEdgeId: null };
  }

  // Nothing granted, nothing withdrawn (both pending) → back to outreach.
  setPathStatus(pathId, "outreach");
  recomputePathConfidence(pathId);
  return { pathReachedDoubleOptIn: false, newEdgeId: null };
}
