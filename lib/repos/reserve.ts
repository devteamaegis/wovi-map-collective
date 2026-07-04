import "server-only";
import { getDb } from "../db";
import { nowIso, parseOrg } from "./util";
import { addOutbox } from "./settings";
import { toUsd } from "./fx";
import { listAttachments } from "./attachments";
import { auditHash } from "../reserve/audit";
import { signApprovalToken, appBaseUrl } from "../reserve/token";
import {
  draftRfqBody,
  detectMissingFields,
  requisitionTotal,
  landedTotal,
  matchDoaRule,
  poNumberFor,
  hsCodeFor,
  rankQuotes,
  threeWayMatch,
  MATCH_LABEL,
} from "../reserve/logic";
import type { RankedQuote } from "../reserve/logic";
import type {
  SpotBuy,
  SpotBuyStatus,
  SpotBuyTrigger,
  Urgency,
  Metal,
  Rfq,
  RfqInvite,
  Quote,
  Requisition,
  Approval,
  DoaRule,
  PurchaseOrder,
  PoLine,
  CustomsPacket,
  AuditEvent,
} from "../reserve/types";

// ------------------------------------------------------------------ helpers

function orgName(db: any, id: number | null): string | null {
  if (id == null) return null;
  const r = db.prepare("SELECT name FROM organizations WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return r?.name ?? null;
}

function personName(db: any, id: number | null): string | null {
  if (id == null) return null;
  const r = db.prepare("SELECT name FROM people WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return r?.name ?? null;
}

function logAudit(
  db: any,
  spotBuyId: number,
  actor: "ai" | "human" | "system",
  action: string,
  detail: string | null,
  opts: { personId?: number | null; stage?: string | null } = {}
): void {
  // Chain from the last HASHED row so interspersed legacy/seed rows (hash NULL)
  // can't inject a null link mid-ledger (#5).
  const prev = db
    .prepare("SELECT hash FROM audit_events WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  const createdAt = nowIso();
  const fields = {
    spot_buy_id: spotBuyId,
    actor,
    actor_person_id: opts.personId ?? null,
    stage: opts.stage ?? null,
    action,
    detail,
    created_at: createdAt,
  };
  const hash = auditHash(prev?.hash ?? null, fields);
  db.prepare(
    `INSERT INTO audit_events (spot_buy_id,actor,actor_person_id,stage,action,detail,prev_hash,hash,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    spotBuyId,
    actor,
    opts.personId ?? null,
    opts.stage ?? null,
    action,
    detail,
    prev?.hash ?? null,
    hash,
    createdAt
  );
}

// Verify the append-only audit ledger has not been tampered with (#5).
export interface AuditIntegrity {
  ok: boolean;
  count: number;
  brokenAtId: number | null;
}
export function verifyAuditChain(): AuditIntegrity {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id,spot_buy_id,actor,actor_person_id,stage,action,detail,prev_hash,hash,created_at FROM audit_events ORDER BY id"
    )
    .all() as any[];
  let prev: string | null = null;
  let hashed = 0;
  let seenHashed = false;
  for (const r of rows) {
    // A legacy/seed prefix (hash NULL) predates the chain and is skipped. But a
    // NULL hash appearing AFTER any hashed row means a real row's hash was
    // blanked to evade verification — treat that as tampering (#5).
    if (r.hash == null) {
      if (seenHashed) return { ok: false, count: hashed, brokenAtId: r.id };
      continue;
    }
    seenHashed = true;
    hashed++;
    if ((r.prev_hash ?? null) !== prev) return { ok: false, count: hashed, brokenAtId: r.id };
    const expected = auditHash(prev, {
      spot_buy_id: r.spot_buy_id,
      actor: r.actor,
      actor_person_id: r.actor_person_id ?? null,
      stage: r.stage ?? null,
      action: r.action,
      detail: r.detail ?? null,
      created_at: r.created_at,
    });
    if (expected !== r.hash) return { ok: false, count: hashed, brokenAtId: r.id };
    prev = r.hash;
  }
  return { ok: true, count: hashed, brokenAtId: null };
}

// Bump the optimistic-lock version on every state change (#15).
function setStatus(db: any, spotBuyId: number, status: SpotBuyStatus): void {
  const closedAt =
    status === "closed" || status === "cancelled" ? nowIso() : null;
  if (closedAt) {
    db.prepare(
      "UPDATE spot_buys SET status=?, closed_at=?, version=version+1 WHERE id=?"
    ).run(status, closedAt, spotBuyId);
  } else {
    db.prepare(
      "UPDATE spot_buys SET status=?, version=version+1 WHERE id=?"
    ).run(status, spotBuyId);
  }
}

// Optimistic-lock guard: throw if the caller's expected version is stale (#15).
export class StaleWriteError extends Error {
  constructor(public expected: number, public actual: number) {
    super(`Stale write: expected version ${expected}, found ${actual}`);
    this.name = "StaleWriteError";
  }
}
export function assertVersion(db: any, spotBuyId: number, expected?: number): void {
  if (expected == null) return;
  const row = db.prepare("SELECT version FROM spot_buys WHERE id=?").get(spotBuyId) as
    | { version: number }
    | undefined;
  if (row && row.version !== expected) throw new StaleWriteError(expected, row.version);
}

// ---- scheduled automation (#6) --------------------------------------------
// SLA windows (overridable by env for demos/tuning). RFQ follow-up fires if a
// supplier hasn't quoted; approval escalation fires if a sign-off stalls.
export const FOLLOWUP_HOURS = Number(process.env.WOVI_FOLLOWUP_HOURS ?? 4);
export const ESCALATION_HOURS = Number(process.env.WOVI_ESCALATION_HOURS ?? 6);

function scheduleJob(
  db: any,
  kind: "rfq_followup" | "approval_escalation",
  spotBuyId: number | null,
  refId: number | null,
  inHours: number
): void {
  const runAt = new Date(Date.now() + inHours * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO scheduled_jobs (kind,spot_buy_id,ref_id,run_at,status,attempts,created_at)
     VALUES (?,?,?,?,'pending',0,?)`
  ).run(kind, spotBuyId, refId, runAt, nowIso());
}

// Cancel outstanding jobs of a kind for a ref (e.g. supplier quoted → drop the
// follow-up; approval decided → drop the escalation).
function cancelJobs(
  db: any,
  kind: "rfq_followup" | "approval_escalation",
  refId: number
): void {
  db.prepare(
    "UPDATE scheduled_jobs SET status='cancelled', done_at=? WHERE kind=? AND ref_id=? AND status='pending'"
  ).run(nowIso(), kind, refId);
}

// ------------------------------------------------------------------- reads

export interface SpotBuyRow extends SpotBuy {
  buyer_org_name: string | null;
  buyer_person_name: string | null;
}

export interface SpotBuyFilter {
  q?: string;
  status?: SpotBuyStatus | "all" | "open";
  urgency?: Urgency | "all";
  trigger?: SpotBuyTrigger | "all";
  sort?: "urgency" | "recent" | "exposure";
}

const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
};

export function listSpotBuys(filter: SpotBuyFilter = {}): SpotBuyRow[] {
  const db = getDb();
  let rows = db
    .prepare(
      `SELECT s.*, o.name AS buyer_org_name, p.name AS buyer_person_name
       FROM spot_buys s
       LEFT JOIN organizations o ON o.id = s.buyer_org_id
       LEFT JOIN people p ON p.id = s.buyer_person_id`
    )
    .all() as SpotBuyRow[];

  const q = (filter.q || "").toLowerCase().trim();
  if (q)
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.material_desc || "").toLowerCase().includes(q) ||
        (r.material_number || "").toLowerCase().includes(q) ||
        r.ref.toLowerCase().includes(q) ||
        (r.buyer_org_name || "").toLowerCase().includes(q)
    );
  if (filter.status && filter.status !== "all") {
    if (filter.status === "open")
      rows = rows.filter((r) => r.status !== "closed" && r.status !== "cancelled");
    else rows = rows.filter((r) => r.status === filter.status);
  }
  if (filter.urgency && filter.urgency !== "all")
    rows = rows.filter((r) => r.urgency === filter.urgency);
  if (filter.trigger && filter.trigger !== "all")
    rows = rows.filter((r) => r.trigger === filter.trigger);

  const sort = filter.sort || "urgency";
  rows.sort((a, b) => {
    if (sort === "recent") return b.created_at.localeCompare(a.created_at);
    if (sort === "exposure")
      return b.downtime_cost_per_hour - a.downtime_cost_per_hour;
    return (
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      b.created_at.localeCompare(a.created_at)
    );
  });
  return rows;
}

export function getSpotBuy(id: number): SpotBuy | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM spot_buys WHERE id = ?").get(id) as
      | SpotBuy
      | undefined) ?? null
  );
}

export interface InviteRow extends RfqInvite {
  supplier_name: string | null;
  supplier_person_name: string | null;
}
export interface QuoteRow extends RankedQuote {
  supplier_name: string | null;
}
export interface ApprovalRow extends Approval {
  approver_name: string | null;
  escalated_to_name: string | null;
}
export interface AuditRow extends AuditEvent {
  actor_person_name: string | null;
}

export interface CandidateSupplier {
  org_id: number;
  name: string;
  country: string | null;
  materials: string[];
  approved: boolean; // has a supply relationship with the buyer
  confidence: number; // best edge confidence to the buyer (0 if none)
  contact_person_id: number | null;
  contact_name: string | null;
}

// The "approved supplier base" for a spot buy: suppliers matching the material,
// ranked by whether they have a supply relationship (edge) with the buyer.
export function candidateSuppliers(sb: SpotBuy): CandidateSupplier[] {
  const db = getDb();
  const suppliers = (
    db.prepare("SELECT * FROM organizations WHERE kind='supplier'").all() as any[]
  ).map(parseOrg);
  const tag = (sb.metal !== "none" ? sb.metal : sb.material_desc || sb.title || "")
    .toLowerCase()
    .trim();

  const out: CandidateSupplier[] = [];
  for (const s of suppliers) {
    const hay = [...s.materials, ...s.capabilities].map((x: string) =>
      x.toLowerCase()
    );
    const matches =
      !tag || hay.some((h: string) => h.includes(tag) || tag.includes(h));
    if (!matches) continue;

    // best edge confidence between this supplier and the buyer (either direction)
    let approved = false;
    let confidence = 0;
    if (sb.buyer_org_id != null) {
      const e = db
        .prepare(
          `SELECT kind, confidence FROM edges
           WHERE ((source_type='org' AND source_id=? AND target_type='org' AND target_id=?)
              OR (source_type='org' AND source_id=? AND target_type='org' AND target_id=?))
           ORDER BY confidence DESC LIMIT 1`
        )
        .get(s.id, sb.buyer_org_id, sb.buyer_org_id, s.id) as
        | { kind: string; confidence: number }
        | undefined;
      if (e) {
        confidence = e.confidence;
        approved =
          e.kind === "supplies" ||
          e.kind === "sources_from" ||
          e.kind === "brokered_intro";
      }
    }
    const contact = db
      .prepare("SELECT id,name FROM people WHERE org_id=? LIMIT 1")
      .get(s.id) as { id: number; name: string } | undefined;

    out.push({
      org_id: s.id,
      name: s.name,
      country: s.country,
      materials: s.materials,
      approved,
      confidence,
      contact_person_id: contact?.id ?? null,
      contact_name: contact?.name ?? null,
    });
  }
  out.sort(
    (a, b) => Number(b.approved) - Number(a.approved) || b.confidence - a.confidence
  );
  return out;
}

export interface SpotBuyDetail {
  spotBuy: SpotBuyRow;
  rfq: Rfq | null;
  invites: InviteRow[];
  quotes: QuoteRow[];
  requisition: (Requisition & { missing: string[] }) | null;
  approvals: ApprovalRow[];
  po: (PurchaseOrder & { lines: PoLine[] }) | null;
  customs: CustomsPacket | null;
  audit: AuditRow[];
  candidates: CandidateSupplier[];
  lines: SpotBuyLine[];
  receipts: GoodsReceipt[];
  attachments: import("./attachments").Attachment[];
}

export function spotBuyDetail(id: number): SpotBuyDetail | null {
  const db = getDb();
  const spotBuy = db
    .prepare(
      `SELECT s.*, o.name AS buyer_org_name, p.name AS buyer_person_name
       FROM spot_buys s
       LEFT JOIN organizations o ON o.id=s.buyer_org_id
       LEFT JOIN people p ON p.id=s.buyer_person_id WHERE s.id=?`
    )
    .get(id) as SpotBuyRow | undefined;
  if (!spotBuy) return null;

  const rfq =
    (db.prepare("SELECT * FROM rfqs WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1").get(
      id
    ) as Rfq | undefined) ?? null;

  const invites = (
    db.prepare("SELECT * FROM rfq_invites WHERE spot_buy_id=? ORDER BY id").all(
      id
    ) as RfqInvite[]
  ).map((iv) => ({
    ...iv,
    supplier_name: orgName(db, iv.supplier_org_id),
    supplier_person_name: personName(db, iv.supplier_person_id),
  }));

  const rawQuotes = db
    .prepare("SELECT * FROM quotes WHERE spot_buy_id=?")
    .all(id) as Quote[];
  const ranked = rankQuotes(rawQuotes);
  const quotes: QuoteRow[] = ranked.map((q) => ({
    ...q,
    supplier_name: orgName(db, q.supplier_org_id),
  }));

  const reqRaw =
    (db.prepare("SELECT * FROM requisitions WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1").get(
      id
    ) as Requisition | undefined) ?? null;
  const requisition = reqRaw
    ? { ...reqRaw, missing: JSON.parse(reqRaw.missing_fields || "[]") }
    : null;

  const approvals = (
    db.prepare("SELECT * FROM approvals WHERE spot_buy_id=? ORDER BY level, id").all(
      id
    ) as Approval[]
  ).map((a) => ({
    ...a,
    approver_name: personName(db, a.approver_person_id),
    escalated_to_name: personName(db, a.escalated_to_person_id),
  }));

  const poRaw =
    (db.prepare("SELECT * FROM purchase_orders WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1").get(
      id
    ) as PurchaseOrder | undefined) ?? null;
  const po = poRaw
    ? {
        ...poRaw,
        lines: db
          .prepare("SELECT * FROM po_lines WHERE po_id=? ORDER BY line_no")
          .all(poRaw.id) as PoLine[],
      }
    : null;

  const customs =
    (db.prepare("SELECT * FROM customs_packets WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1").get(
      id
    ) as CustomsPacket | undefined) ?? null;

  const audit = (
    db.prepare("SELECT * FROM audit_events WHERE spot_buy_id=? ORDER BY id DESC").all(
      id
    ) as AuditEvent[]
  ).map((a) => ({ ...a, actor_person_name: personName(db, a.actor_person_id) }));

  return {
    spotBuy,
    rfq,
    invites,
    quotes,
    requisition,
    approvals,
    po,
    customs,
    audit,
    candidates: candidateSuppliers(spotBuy),
    lines: spotBuyLines(id),
    receipts: goodsReceipts(id),
    attachments: listAttachments(id),
  };
}

export function doaRules(): DoaRule[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM doa_rules ORDER BY min_amount")
    .all() as DoaRule[];
}

export interface ApprovalQueueRow extends ApprovalRow {
  ref: string;
  title: string;
  buyer_org_name: string | null;
  urgency: Urgency;
}

export function approvalsQueue(): ApprovalQueueRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, s.ref, s.title, s.urgency, o.name AS buyer_org_name
       FROM approvals a
       JOIN spot_buys s ON s.id=a.spot_buy_id
       LEFT JOIN organizations o ON o.id=s.buyer_org_id
       WHERE a.status='pending'
       ORDER BY CASE s.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'med' THEN 2 ELSE 3 END, a.created_at`
    )
    .all() as any[];
  return rows.map((a) => ({
    ...a,
    approver_name: personName(db, a.approver_person_id),
    escalated_to_name: personName(db, a.escalated_to_person_id),
  }));
}

export interface ReserveStats {
  openBuys: number;
  critical: number;
  awaitingApproval: number;
  poReleased: number;
  totalExposurePerHour: number;
}

export function reserveStats(): ReserveStats {
  const db = getDb();
  const open = db
    .prepare(
      "SELECT COUNT(*) c, COALESCE(SUM(downtime_cost_per_hour),0) e FROM spot_buys WHERE status NOT IN ('closed','cancelled')"
    )
    .get() as { c: number; e: number };
  const critical = (
    db
      .prepare(
        "SELECT COUNT(*) c FROM spot_buys WHERE urgency='critical' AND status NOT IN ('closed','cancelled')"
      )
      .get() as { c: number }
  ).c;
  const awaiting = (
    db.prepare("SELECT COUNT(*) c FROM approvals WHERE status='pending'").get() as {
      c: number;
    }
  ).c;
  const released = (
    db
      .prepare("SELECT COUNT(*) c FROM purchase_orders WHERE status IN ('released','acknowledged','closed')")
      .get() as { c: number }
  ).c;
  return {
    openBuys: open.c,
    critical,
    awaitingApproval: awaiting,
    poReleased: released,
    totalExposurePerHour: open.e,
  };
}

// ---------------------------------------------------------------- mutations

export interface CreateSpotBuyInput {
  title: string;
  material_number?: string | null;
  material_desc?: string | null;
  quantity: number;
  uom?: string | null;
  required_by?: string | null;
  cost_center?: string | null;
  plant?: string | null;
  trigger: SpotBuyTrigger;
  urgency: Urgency;
  downtime_cost_per_hour: number;
  buyer_org_id: number | null;
  buyer_person_id: number | null;
  cross_border: boolean;
  metal: Metal;
  ship_from_country?: string | null;
  ship_to_country?: string | null;
  incoterm?: string | null;
  // Set when the need was ingested from an external system (e.g. "SAP MRP",
  // "QMS webhook") — logs a system audit event instead of a human one.
  via?: string | null;
}

function nextRef(db: any): string {
  const row = db.prepare("SELECT COUNT(*) c FROM spot_buys").get() as { c: number };
  return `SB-${1041 + row.c}`;
}

export function createSpotBuy(input: CreateSpotBuyInput): number {
  const db = getDb();
  const now = nowIso();
  const ref = nextRef(db);
  const info = db
    .prepare(
      `INSERT INTO spot_buys
       (ref,title,material_number,material_desc,quantity,uom,required_by,cost_center,plant,trigger,urgency,downtime_cost_per_hour,buyer_org_id,buyer_person_id,cross_border,metal,ship_from_country,ship_to_country,incoterm,status,urgency_confirmed,created_at,closed_at)
       VALUES (@ref,@title,@material_number,@material_desc,@quantity,@uom,@required_by,@cost_center,@plant,@trigger,@urgency,@downtime,@buyer_org_id,@buyer_person_id,@cross_border,@metal,@ship_from,@ship_to,@incoterm,'triage',0,@now,NULL)`
    )
    .run({
      ref,
      title: input.title,
      material_number: input.material_number ?? null,
      material_desc: input.material_desc ?? null,
      quantity: input.quantity,
      uom: input.uom ?? null,
      required_by: input.required_by ?? null,
      cost_center: input.cost_center ?? null,
      plant: input.plant ?? null,
      trigger: input.trigger,
      urgency: input.urgency,
      downtime: input.downtime_cost_per_hour,
      buyer_org_id: input.buyer_org_id,
      buyer_person_id: input.buyer_person_id,
      cross_border: input.cross_border ? 1 : 0,
      metal: input.metal,
      ship_from: input.ship_from_country ?? null,
      ship_to: input.ship_to_country ?? null,
      incoterm: input.incoterm ?? null,
      now,
    });
  const id = Number(info.lastInsertRowid);
  if (input.via) {
    logAudit(
      db,
      id,
      "system",
      "Trigger ingested via API",
      `${ref} — ${input.title} (source: ${input.via})`,
      { stage: "triage" }
    );
  } else {
    logAudit(db, id, "human", "Spot buy logged", `${ref} — ${input.title}`, {
      personId: input.buyer_person_id,
      stage: "triage",
    });
  }
  if (input.cross_border) {
    db.prepare(
      `INSERT INTO customs_packets (spot_buy_id,po_id,required,metal,status,created_at)
       VALUES (?,NULL,1,?,'not_required',?)`
    ).run(id, input.metal, now);
  }
  return id;
}

export function confirmUrgency(spotBuyId: number, personId: number | null): void {
  const db = getDb();
  db.prepare(
    "UPDATE spot_buys SET urgency_confirmed=1, status='sourcing' WHERE id=? AND status='triage'"
  ).run(spotBuyId);
  logAudit(db, spotBuyId, "human", "Urgency confirmed", "Cleared to source", {
    personId,
    stage: "triage",
  });
}

// Stage 2 — AI drafts the RFQ + pre-selects the approved supplier base.
export function draftRfq(spotBuyId: number): number {
  const db = getDb();
  const sb = getSpotBuy(spotBuyId)!;
  const candidates = candidateSuppliers(sb).slice(0, 5);
  const body = draftRfqBody(
    sb,
    orgName(db, sb.buyer_org_id),
    candidates.map((c) => c.name)
  );
  const now = nowIso();
  const info = db
    .prepare(
      "INSERT INTO rfqs (spot_buy_id,draft_body,status,created_at) VALUES (?,?,'draft',?)"
    )
    .run(spotBuyId, body, now);
  const rfqId = Number(info.lastInsertRowid);
  // pre-create invites for the approved base (human approves the send)
  for (const c of candidates) {
    db.prepare(
      `INSERT INTO rfq_invites (rfq_id,spot_buy_id,supplier_org_id,supplier_person_id,channel,status,follow_up_count,invited_at)
       VALUES (?,?,?,?,'email','invited',0,?)`
    ).run(rfqId, spotBuyId, c.org_id, c.contact_person_id, now);
  }
  if (sb.status === "triage") setStatus(db, spotBuyId, "sourcing");
  logAudit(
    db,
    spotBuyId,
    "ai",
    "RFQ drafted",
    `Drafted RFQ + selected ${candidates.length} approved suppliers`,
    { stage: "sourcing" }
  );
  return rfqId;
}

export function updateRfqBody(rfqId: number, body: string): void {
  const db = getDb();
  db.prepare("UPDATE rfqs SET draft_body=? WHERE id=?").run(body, rfqId);
}

export function toggleInvite(
  rfqId: number,
  supplierOrgId: number,
  on: boolean
): void {
  const db = getDb();
  const sb = db.prepare("SELECT spot_buy_id FROM rfqs WHERE id=?").get(rfqId) as
    | { spot_buy_id: number }
    | undefined;
  if (!sb) return;
  const existing = db
    .prepare("SELECT id FROM rfq_invites WHERE rfq_id=? AND supplier_org_id=?")
    .get(rfqId, supplierOrgId) as { id: number } | undefined;
  if (on && !existing) {
    const contact = db
      .prepare("SELECT id FROM people WHERE org_id=? LIMIT 1")
      .get(supplierOrgId) as { id: number } | undefined;
    db.prepare(
      `INSERT INTO rfq_invites (rfq_id,spot_buy_id,supplier_org_id,supplier_person_id,channel,status,follow_up_count,invited_at)
       VALUES (?,?,?,?,'email','invited',0,?)`
    ).run(rfqId, sb.spot_buy_id, supplierOrgId, contact?.id ?? null, nowIso());
  } else if (!on && existing) {
    db.prepare("DELETE FROM rfq_invites WHERE id=?").run(existing.id);
  }
}

export function approveRfqSend(rfqId: number, personId: number | null): void {
  const db = getDb();
  const rfq = db.prepare("SELECT * FROM rfqs WHERE id=?").get(rfqId) as
    | Rfq
    | undefined;
  if (!rfq) return;
  const now = nowIso();
  db.prepare(
    "UPDATE rfqs SET status='sent', sent_at=?, approved_by_person_id=? WHERE id=?"
  ).run(now, personId, rfqId);
  const sb = getSpotBuy(rfq.spot_buy_id)!;
  // One outbound message per invite lands in the local outbox (integrations page).
  const recipients = db
    .prepare(
      `SELECT iv.id AS invite_id, o.name AS org_name, p.name AS person_name, p.email
       FROM rfq_invites iv
       LEFT JOIN organizations o ON o.id = iv.supplier_org_id
       LEFT JOIN people p ON p.id = iv.supplier_person_id
       WHERE iv.rfq_id = ?`
    )
    .all(rfqId) as { invite_id: number; org_name: string | null; person_name: string | null; email: string | null }[];
  for (const r of recipients) {
    addOutbox({
      channel: "email",
      recipient: r.email || r.person_name || r.org_name,
      subject: `Urgent RFQ ${sb.ref} — ${sb.title}`,
      body: rfq.draft_body,
      spot_buy_id: rfq.spot_buy_id,
    });
    // Schedule an automatic follow-up if this supplier hasn't quoted in time (#6).
    scheduleJob(db, "rfq_followup", rfq.spot_buy_id, r.invite_id, FOLLOWUP_HOURS);
  }
  logAudit(
    db,
    rfq.spot_buy_id,
    "human",
    "RFQ broadcast approved",
    `Sent to ${recipients.length} approved suppliers`,
    { personId, stage: "sourcing" }
  );
}

export function followUpInvite(inviteId: number): void {
  const db = getDb();
  const iv = db.prepare("SELECT * FROM rfq_invites WHERE id=?").get(inviteId) as
    | RfqInvite
    | undefined;
  if (!iv) return;
  db.prepare(
    "UPDATE rfq_invites SET status='followed_up', follow_up_count=follow_up_count+1, last_followed_up_at=? WHERE id=?"
  ).run(nowIso(), inviteId);
  const sb = getSpotBuy(iv.spot_buy_id)!;
  const contact = db
    .prepare("SELECT name,email FROM people WHERE id=?")
    .get(iv.supplier_person_id ?? -1) as { name: string; email: string | null } | undefined;
  addOutbox({
    channel: "email",
    recipient: contact?.email || contact?.name || orgName(db, iv.supplier_org_id),
    subject: `Follow-up: RFQ ${sb.ref} — awaiting your quote`,
    body: `Following up on our urgent RFQ ${sb.ref} (${sb.title}). We are working against a potential line stoppage — a quote today would be greatly appreciated.`,
    spot_buy_id: iv.spot_buy_id,
  });
  logAudit(
    db,
    iv.spot_buy_id,
    "ai",
    "Follow-up sent",
    `Timed follow-up to ${orgName(db, iv.supplier_org_id)}`,
    { stage: "sourcing" }
  );
}

// Stage 3 — a quote arrives (AI-parsed into the comparison view).
export interface AddQuoteInput {
  spot_buy_id: number;
  supplier_org_id: number;
  unit_price: number;
  quantity: number;
  lead_time_days: number;
  moq?: number | null;
  freight_cost: number;
  freight_mode?: string | null;
  incoterm?: string | null;
  source_format?: string | null;
  notes?: string | null;
  currency?: string;
}

export function addQuote(input: AddQuoteInput): number {
  const db = getDb();
  const invite = db
    .prepare(
      "SELECT id, supplier_person_id FROM rfq_invites WHERE spot_buy_id=? AND supplier_org_id=? LIMIT 1"
    )
    .get(input.spot_buy_id, input.supplier_org_id) as
    | { id: number; supplier_person_id: number | null }
    | undefined;
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO quotes (spot_buy_id,rfq_invite_id,supplier_org_id,supplier_person_id,unit_price,currency,quantity,lead_time_days,moq,freight_cost,freight_mode,incoterm,valid_until,source_format,notes,selected,received_at)
       VALUES (@sb,@inv,@sup,@sp,@up,@cur,@qty,@lt,@moq,@fr,@fm,@inc,NULL,@sf,@notes,0,@now)`
    )
    .run({
      sb: input.spot_buy_id,
      inv: invite?.id ?? null,
      sup: input.supplier_org_id,
      sp: invite?.supplier_person_id ?? null,
      up: input.unit_price,
      cur: input.currency ?? "USD",
      qty: input.quantity,
      lt: input.lead_time_days,
      moq: input.moq ?? null,
      fr: input.freight_cost,
      fm: input.freight_mode ?? null,
      inc: input.incoterm ?? null,
      sf: input.source_format ?? "email",
      notes: input.notes ?? null,
      now,
    });
  if (invite) {
    db.prepare("UPDATE rfq_invites SET status='quoted' WHERE id=?").run(invite.id);
    cancelJobs(db, "rfq_followup", invite.id); // quoted → no follow-up needed (#6)
  }
  const sb = getSpotBuy(input.spot_buy_id)!;
  if (sb.status === "sourcing") setStatus(db, input.spot_buy_id, "quoting");
  logAudit(
    db,
    input.spot_buy_id,
    "ai",
    "Quote parsed",
    `${orgName(db, input.supplier_org_id)}: ${landedTotal({
      unit_price: input.unit_price,
      quantity: input.quantity,
      freight_cost: input.freight_cost,
    }).toLocaleString("en-US", { style: "currency", currency: "USD" })} landed`,
    { stage: "quoting" }
  );
  return Number(info.lastInsertRowid);
}

export function selectQuote(quoteId: number, personId: number | null): void {
  const db = getDb();
  const q = db.prepare("SELECT * FROM quotes WHERE id=?").get(quoteId) as
    | Quote
    | undefined;
  if (!q) return;
  db.prepare("UPDATE quotes SET selected=0 WHERE spot_buy_id=?").run(q.spot_buy_id);
  db.prepare("UPDATE quotes SET selected=1 WHERE id=?").run(quoteId);
  const sb = getSpotBuy(q.spot_buy_id)!;
  if (sb.status === "quoting" || sb.status === "sourcing")
    setStatus(db, q.spot_buy_id, "requisition");
  logAudit(
    db,
    q.spot_buy_id,
    "human",
    "Supplier selected",
    `${orgName(db, q.supplier_org_id)} on best value`,
    { personId, stage: "quoting" }
  );
}

// Stage 4 — pre-fill the requisition from the selected quote.
export function buildRequisition(spotBuyId: number): number {
  const db = getDb();
  const sb = getSpotBuy(spotBuyId)!;
  const q = db
    .prepare("SELECT * FROM quotes WHERE spot_buy_id=? AND selected=1 LIMIT 1")
    .get(spotBuyId) as Quote | undefined;
  const now = nowIso();
  const linesExtra = spotBuyLinesTotal(spotBuyId); // additional materials (#11)
  const total =
    (q ? requisitionTotal(q.unit_price, q.quantity, q.freight_cost) : 0) + linesExtra;
  const draft = {
    material_number: sb.material_number,
    material_desc: sb.material_desc,
    quantity: q?.quantity ?? sb.quantity,
    uom: sb.uom,
    cost_center: sb.cost_center,
    need_by: sb.required_by,
    supplier_org_id: q?.supplier_org_id ?? null,
    unit_price: q?.unit_price ?? 0,
    freight_cost: q?.freight_cost ?? 0,
    total_value: total,
    currency: q?.currency ?? "USD",
  };
  const missing = detectMissingFields(draft);
  const totalBase = toUsd(draft.total_value, draft.currency);
  const info = db
    .prepare(
      `INSERT INTO requisitions (spot_buy_id,quote_id,material_number,material_desc,quantity,uom,cost_center,need_by,supplier_org_id,unit_price,freight_cost,total_value,total_value_base,currency,missing_fields,status,created_at)
       VALUES (@sb,@qid,@mn,@md,@qty,@uom,@cc,@nb,@sup,@up,@fr,@tv,@tvb,@cur,@mf,'draft',@now)`
    )
    .run({
      sb: spotBuyId,
      qid: q?.id ?? null,
      mn: draft.material_number,
      md: draft.material_desc,
      qty: draft.quantity,
      uom: draft.uom,
      cc: draft.cost_center,
      nb: draft.need_by,
      sup: draft.supplier_org_id,
      up: draft.unit_price,
      fr: draft.freight_cost,
      tv: draft.total_value,
      tvb: totalBase,
      cur: draft.currency,
      mf: JSON.stringify(missing),
      now,
    });
  logAudit(
    db,
    spotBuyId,
    "ai",
    "Requisition pre-filled",
    missing.length
      ? `Flagged ${missing.length} missing field(s): ${missing.join(", ")}`
      : "All fields complete",
    { stage: "requisition" }
  );
  return Number(info.lastInsertRowid);
}

export interface UpdateRequisitionInput {
  material_number?: string | null;
  cost_center?: string | null;
  need_by?: string | null;
  quantity?: number;
}

export function updateRequisition(
  reqId: number,
  input: UpdateRequisitionInput
): void {
  const db = getDb();
  const req = db.prepare("SELECT * FROM requisitions WHERE id=?").get(reqId) as
    | Requisition
    | undefined;
  if (!req) return;
  const merged = {
    material_number: input.material_number ?? req.material_number,
    quantity: input.quantity ?? req.quantity,
    cost_center: input.cost_center ?? req.cost_center,
    need_by: input.need_by ?? req.need_by,
    supplier_org_id: req.supplier_org_id,
  };
  const total =
    requisitionTotal(req.unit_price, merged.quantity, req.freight_cost) +
    spotBuyLinesTotal(req.spot_buy_id);
  const missing = detectMissingFields(merged);
  const totalBase = toUsd(total, req.currency);
  db.prepare(
    "UPDATE requisitions SET material_number=?, quantity=?, cost_center=?, need_by=?, total_value=?, total_value_base=?, missing_fields=? WHERE id=?"
  ).run(
    merged.material_number,
    merged.quantity,
    merged.cost_center,
    merged.need_by,
    total,
    totalBase,
    JSON.stringify(missing),
    reqId
  );
}

// Stage 5 — submit requisition → route to the DOA approver by threshold.
export function submitRequisition(reqId: number, personId: number | null): void {
  const db = getDb();
  const req = db.prepare("SELECT * FROM requisitions WHERE id=?").get(reqId) as
    | Requisition
    | undefined;
  if (!req) return;
  db.prepare(
    "UPDATE requisitions SET status='submitted', submitted_at=?, submitted_by_person_id=? WHERE id=?"
  ).run(nowIso(), personId, reqId);

  // Route on the base-currency value so DOA bands are currency-agnostic (#11).
  const routingAmount = req.total_value_base || req.total_value;
  const rule = matchDoaRule(doaRules(), routingAmount);
  const approvalInfo = db
    .prepare(
      `INSERT INTO approvals (spot_buy_id,requisition_id,level,approver_person_id,role,threshold_min,threshold_max,amount,status,created_at)
       VALUES (?,?,1,?,?,?,?,?,'pending',?)`
    )
    .run(
      req.spot_buy_id,
      reqId,
      rule?.approver_person_id ?? null,
      rule?.role ?? "Approver",
      rule?.min_amount ?? 0,
      rule?.max_amount ?? null,
      routingAmount,
      nowIso()
    );
  // Auto-escalate if not decided within the SLA window (#6).
  scheduleJob(db, "approval_escalation", req.spot_buy_id, Number(approvalInfo.lastInsertRowid), ESCALATION_HOURS);
  setStatus(db, req.spot_buy_id, "approval");
  logAudit(db, req.spot_buy_id, "human", "Requisition submitted", null, {
    personId,
    stage: "requisition",
  });
  const approver = rule?.approver_person_id
    ? (db
        .prepare("SELECT name,email FROM people WHERE id=?")
        .get(rule.approver_person_id) as { name: string; email: string | null } | undefined)
    : undefined;
  const sb = getSpotBuy(req.spot_buy_id)!;
  const approvalId = Number(approvalInfo.lastInsertRowid);
  const base = appBaseUrl();
  const approveLink = `${base}/approve?token=${signApprovalToken(approvalId, "approved")}`;
  const rejectLink = `${base}/approve?token=${signApprovalToken(approvalId, "rejected")}`;
  addOutbox({
    channel: "email",
    recipient: approver?.email || approver?.name || "approver",
    subject: `Approval needed: ${sb.ref} — ${sb.title}`,
    body: `A spot-buy requisition needs your sign-off.\n\nAmount: ${req.total_value.toLocaleString("en-US", { style: "currency", currency: req.currency || "USD" })}\nRole: ${rule?.role ?? "Approver"}\nUrgency: ${sb.urgency}\n\nApprove (one tap): ${approveLink}\nReject: ${rejectLink}\n\nOr review in Reserve: ${base}/reserve/${sb.id}`,
    spot_buy_id: req.spot_buy_id,
  });
  logAudit(
    db,
    req.spot_buy_id,
    "system",
    "Routed for DOA approval",
    `${rule?.role ?? "Approver"} — ${approver?.name ?? "unassigned"}`,
    { stage: "approval" }
  );
}

// Segregation-of-duties: the person who submitted the requisition may not
// approve it (SOX §404). Returns the blocking submitter id, or null if clear.
export function sodConflict(approvalId: number, actingPersonId: number | null): number | null {
  if (actingPersonId == null) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT r.submitted_by_person_id AS submitter
       FROM approvals a JOIN requisitions r ON r.id = a.requisition_id
       WHERE a.id = ?`
    )
    .get(approvalId) as { submitter: number | null } | undefined;
  if (row && row.submitter != null && row.submitter === actingPersonId) return row.submitter;
  return null;
}

export function decideApproval(
  approvalId: number,
  decision: "approved" | "rejected",
  personId: number | null,
  note?: string | null
): void {
  const db = getDb();
  const a = db.prepare("SELECT * FROM approvals WHERE id=?").get(approvalId) as
    | Approval
    | undefined;
  if (!a) return;
  // Concurrency guard (#15): only a still-pending approval can be decided, so two
  // approvers (or a double-click) can't both act on the same sign-off.
  if (a.status !== "pending") return;
  db.prepare("UPDATE approvals SET status=?, decided_at=?, note=? WHERE id=? AND status='pending'").run(
    decision,
    nowIso(),
    note ?? null,
    approvalId
  );
  cancelJobs(db, "approval_escalation", approvalId); // decided → no escalation (#6)
  if (decision === "approved") {
    setStatus(db, a.spot_buy_id, "po");
    logAudit(
      db,
      a.spot_buy_id,
      "human",
      "Approval granted",
      `${a.role ?? "Approver"} released the requisition to PO`,
      { personId, stage: "approval" }
    );
  } else {
    setStatus(db, a.spot_buy_id, "requisition");
    logAudit(db, a.spot_buy_id, "human", "Approval rejected", note ?? null, {
      personId,
      stage: "approval",
    });
  }
}

// Auto-escalate to the next-higher DOA band (approver unavailable).
export function escalateApproval(approvalId: number): void {
  const db = getDb();
  const a = db.prepare("SELECT * FROM approvals WHERE id=?").get(approvalId) as
    | Approval
    | undefined;
  if (!a) return;
  // Concurrency guard (#15): only a still-pending approval can be escalated, so a
  // decide-vs-cron race can't orphan a second sign-off after the buy has moved on.
  if (a.status !== "pending") return;
  const rules = doaRules().sort((x, y) => x.min_amount - y.min_amount);
  const next = rules.find((r) => r.min_amount > (a.threshold_min ?? 0));
  // Already at the top DOA band — there's no higher authority to escalate to.
  // Leave the approval pending (re-notify) instead of spawning an orphan that
  // would escalate forever.
  if (!next) {
    cancelJobs(db, "approval_escalation", approvalId);
    logAudit(
      db,
      a.spot_buy_id,
      "system",
      "Escalation held",
      `Already at the highest authority (${a.role ?? "top band"}) — awaiting decision`,
      { stage: "approval" }
    );
    return;
  }
  db.prepare(
    "UPDATE approvals SET status='escalated', escalated_to_person_id=?, decided_at=? WHERE id=? AND status='pending'"
  ).run(next.approver_person_id ?? null, nowIso(), approvalId);
  cancelJobs(db, "approval_escalation", approvalId);
  const escInfo = db
    .prepare(
      `INSERT INTO approvals (spot_buy_id,requisition_id,level,approver_person_id,role,threshold_min,threshold_max,amount,status,created_at)
       VALUES (?,?,?,?,?,?,?,?,'pending',?)`
    )
    .run(
      a.spot_buy_id,
      a.requisition_id,
      a.level + 1,
      next.approver_person_id ?? null,
      next.role ?? "Escalation",
      next.min_amount,
      next.max_amount ?? null,
      a.amount,
      nowIso()
    );
  scheduleJob(db, "approval_escalation", a.spot_buy_id, Number(escInfo.lastInsertRowid), ESCALATION_HOURS);
  logAudit(
    db,
    a.spot_buy_id,
    "system",
    "Approval escalated",
    `Auto-escalated to ${next.role ?? "next authority"} — ${personName(db, next.approver_person_id ?? null) ?? "unassigned"}`,
    { stage: "approval" }
  );
}

// Stage 6 — draft the PO in ERP format for human release.
export function draftPo(spotBuyId: number): number {
  const db = getDb();
  const sb = getSpotBuy(spotBuyId)!;
  // Concurrency guard (#15): don't draft a second PO if one already exists.
  const existing = db
    .prepare("SELECT id FROM purchase_orders WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(spotBuyId) as { id: number } | undefined;
  if (existing) return existing.id;
  const req = db
    .prepare("SELECT * FROM requisitions WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(spotBuyId) as Requisition | undefined;
  if (!req) return 0;
  const now = nowIso();
  const poNo = poNumberFor(sb);
  const info = db
    .prepare(
      `INSERT INTO purchase_orders (spot_buy_id,requisition_id,po_number,supplier_org_id,currency,total_value,incoterm,status,drafted_at)
       VALUES (?,?,?,?,?,?,?,'drafted',?)`
    )
    .run(
      spotBuyId,
      req.id,
      poNo,
      req.supplier_org_id,
      req.currency,
      req.total_value,
      sb.incoterm,
      now
    );
  const poId = Number(info.lastInsertRowid);
  const insLine = db.prepare(
    "INSERT INTO po_lines (po_id,line_no,description,quantity,uom,unit_price,amount) VALUES (?,?,?,?,?,?,?)"
  );
  let lineNo = 1;
  // Primary material (from the selected quote / requisition).
  insLine.run(poId, lineNo++, req.material_desc || sb.title, req.quantity, req.uom, req.unit_price, req.unit_price * req.quantity);
  // Additional materials on this multi-line spot buy (#11).
  for (const l of spotBuyLines(spotBuyId)) {
    insLine.run(poId, lineNo++, l.material_desc || l.material_number || "Line item", l.quantity, l.uom, l.unit_price, l.unit_price * l.quantity);
  }
  if (req.freight_cost > 0)
    insLine.run(poId, lineNo++, "Expedited freight", 1, "lot", req.freight_cost, req.freight_cost);
  const lineCount = lineNo - 1;
  logAudit(db, spotBuyId, "ai", "PO drafted", `${poNo} in ERP format${lineCount > 2 ? ` — ${lineCount} lines` : ""}`, {
    stage: "po",
  });
  return poId;
}

export function releasePo(poId: number, personId: number | null): void {
  const db = getDb();
  const po = db.prepare("SELECT * FROM purchase_orders WHERE id=?").get(poId) as
    | PurchaseOrder
    | undefined;
  if (!po) return;
  // Concurrency guard (#15): a PO can only be released once (idempotent release).
  if (po.status !== "drafted") return;
  db.prepare(
    "UPDATE purchase_orders SET status='released', released_at=?, released_by_person_id=? WHERE id=? AND status='drafted'"
  ).run(nowIso(), personId, poId);
  const sb = getSpotBuy(po.spot_buy_id)!;
  const contact = po.supplier_org_id
    ? (db
        .prepare("SELECT name,email FROM people WHERE org_id=? LIMIT 1")
        .get(po.supplier_org_id) as { name: string; email: string | null } | undefined)
    : undefined;
  addOutbox({
    channel: "email",
    recipient: contact?.email || contact?.name || orgName(db, po.supplier_org_id),
    subject: `Purchase order ${po.po_number} — released`,
    body: `${po.po_number} has been released against RFQ ${sb.ref} (${sb.title}). Total ${po.total_value.toLocaleString("en-US", { style: "currency", currency: "USD" })} ${po.incoterm ?? ""}. Please acknowledge.`,
    spot_buy_id: po.spot_buy_id,
  });
  logAudit(db, po.spot_buy_id, "human", "PO released", `${po.po_number} released to supplier`, {
    personId,
    stage: "po",
  });
  // Domestic buys advance straight to goods receipt; cross-border waits on
  // customs verification first (which then advances to receiving).
  if (!sb.cross_border) {
    setStatus(db, po.spot_buy_id, "receiving");
    logAudit(db, po.spot_buy_id, "system", "Awaiting goods receipt", "PO released — pending delivery + 3-way match", {
      stage: "receiving",
    });
  }
}

// Stage 7 (parallel) — assemble the customs packet for cross-border metal.
export function assembleCustoms(spotBuyId: number): void {
  const db = getDb();
  const sb = getSpotBuy(spotBuyId)!;
  const packet = db
    .prepare("SELECT * FROM customs_packets WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(spotBuyId) as CustomsPacket | undefined;
  const po = db
    .prepare("SELECT id FROM purchase_orders WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(spotBuyId) as { id: number } | undefined;
  const hs = hsCodeFor(sb.metal, sb.material_desc);
  const origin = sb.ship_from_country || "supplier country";
  if (packet) {
    db.prepare(
      `UPDATE customs_packets SET po_id=?, required=1, metal=?, hs_code=?, country_of_melt_pour=?, country_of_smelt_cast=?, commercial_invoice_status='drafted', mill_cert_status='requested', status='ready' WHERE id=?`
    ).run(
      po?.id ?? null,
      sb.metal,
      hs,
      sb.metal === "steel" ? origin : null,
      sb.metal === "aluminum" ? origin : null,
      packet.id
    );
  } else {
    db.prepare(
      `INSERT INTO customs_packets (spot_buy_id,po_id,required,metal,hs_code,country_of_melt_pour,country_of_smelt_cast,commercial_invoice_status,mill_cert_status,status,created_at)
       VALUES (?,?,1,?,?,?,?,'drafted','requested','ready',?)`
    ).run(
      spotBuyId,
      po?.id ?? null,
      sb.metal,
      hs,
      sb.metal === "steel" ? origin : null,
      sb.metal === "aluminum" ? origin : null,
      nowIso()
    );
  }
  logAudit(
    db,
    spotBuyId,
    "ai",
    "Customs packet assembled",
    `HS ${hs}, commercial invoice + ${sb.metal} ${sb.metal === "steel" ? "melt/pour" : "smelt/cast"} declaration; mill cert requested`,
    { stage: "closed" }
  );
}

export function setCustomsBroker(packetId: number, brokerPersonId: number): void {
  const db = getDb();
  db.prepare("UPDATE customs_packets SET broker_person_id=? WHERE id=?").run(
    brokerPersonId,
    packetId
  );
}

export function verifyCustoms(
  packetId: number,
  brokerPersonId: number | null
): void {
  const db = getDb();
  const p = db.prepare("SELECT * FROM customs_packets WHERE id=?").get(packetId) as
    | CustomsPacket
    | undefined;
  if (!p) return;
  db.prepare(
    "UPDATE customs_packets SET mill_cert_status='verified', status='verified', broker_person_id=COALESCE(?,broker_person_id), verified_at=? WHERE id=?"
  ).run(brokerPersonId, nowIso(), packetId);
  logAudit(
    db,
    p.spot_buy_id,
    "human",
    "Customs verified",
    "Broker verified mill certificate + declarations",
    { personId: brokerPersonId, stage: "receiving" }
  );
  setStatus(db, p.spot_buy_id, "receiving");
  logAudit(db, p.spot_buy_id, "system", "Awaiting goods receipt", "Customs cleared — pending delivery + 3-way match", {
    stage: "receiving",
  });
}

// Convenience for the live demo: generate plausible incoming quotes from the
// invited suppliers (stands in for real supplier replies parsed by AI).
function basePrice(sb: SpotBuy): number {
  if (sb.metal === "steel") return 1.25;
  if (sb.metal === "aluminum") return 3.6;
  const d = (sb.material_desc || "").toLowerCase();
  if (d.includes("copper")) return 9.2;
  if (d.includes("connector") || d.includes("electronic")) return 2.4;
  if (d.includes("bearing")) return 38;
  return 45;
}

export function simulateIncomingQuotes(spotBuyId: number): number {
  const db = getDb();
  const sb = getSpotBuy(spotBuyId)!;
  const invites = db
    .prepare(
      "SELECT * FROM rfq_invites WHERE spot_buy_id=? AND status IN ('invited','followed_up') ORDER BY id"
    )
    .all(spotBuyId) as RfqInvite[];
  const already = (
    db.prepare("SELECT COUNT(*) c FROM quotes WHERE spot_buy_id=?").get(spotBuyId) as {
      c: number;
    }
  ).c;
  const base = basePrice(sb);
  const qty = sb.quantity || 1;
  const urgencyFreight =
    sb.urgency === "critical" ? 0.55 : sb.urgency === "high" ? 0.35 : 0.2;
  let created = 0;
  invites.slice(0, 3).forEach((iv, i) => {
    // deterministic variation per supplier
    const vp = 1 + ((iv.supplier_org_id % 7) - 3) * 0.03; // ±9%
    const unit = Math.round(base * vp * 100) / 100;
    const lead = 3 + ((iv.supplier_org_id + i) % 10);
    const freight =
      Math.round(unit * qty * urgencyFreight * (1 + (i % 3) * 0.1));
    const formats = ["pdf", "excel", "email"] as const;
    addQuote({
      spot_buy_id: spotBuyId,
      supplier_org_id: iv.supplier_org_id,
      unit_price: unit,
      quantity: qty,
      lead_time_days: lead,
      moq: Math.round(qty * 0.5),
      freight_cost: freight,
      freight_mode: sb.urgency === "critical" ? "air" : "expedited_ground",
      incoterm: sb.incoterm || "DAP",
      source_format: formats[(already + i) % formats.length],
      notes: null,
    });
    created++;
  });
  return created;
}

export function cancelSpotBuy(spotBuyId: number, personId: number | null): void {
  const db = getDb();
  setStatus(db, spotBuyId, "cancelled");
  logAudit(db, spotBuyId, "human", "Spot buy cancelled", null, {
    personId,
    stage: null,
  });
}

// ---- multi-line spot buys (#11) -------------------------------------------
export interface SpotBuyLine {
  id: number;
  spot_buy_id: number;
  line_no: number;
  material_number: string | null;
  material_desc: string | null;
  quantity: number;
  uom: string | null;
  unit_price: number;
}

export function spotBuyLines(spotBuyId: number): SpotBuyLine[] {
  return getDb()
    .prepare("SELECT * FROM spot_buy_lines WHERE spot_buy_id=? ORDER BY line_no")
    .all(spotBuyId) as SpotBuyLine[];
}

// Extended value of the additional lines (Σ unit_price × quantity) — folds into
// the requisition total and the PO so multi-line buys are priced in full (#11).
export function spotBuyLinesTotal(spotBuyId: number): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(unit_price * quantity),0) t FROM spot_buy_lines WHERE spot_buy_id=?")
    .get(spotBuyId) as { t: number };
  return row.t;
}

export function addSpotBuyLine(
  spotBuyId: number,
  line: { material_number?: string | null; material_desc: string; quantity: number; uom?: string | null; unit_price?: number }
): number {
  const db = getDb();
  const n = (db.prepare("SELECT COALESCE(MAX(line_no),0) m FROM spot_buy_lines WHERE spot_buy_id=?").get(spotBuyId) as { m: number }).m;
  const info = db
    .prepare(
      "INSERT INTO spot_buy_lines (spot_buy_id,line_no,material_number,material_desc,quantity,uom,unit_price) VALUES (?,?,?,?,?,?,?)"
    )
    .run(spotBuyId, n + 1, line.material_number ?? null, line.material_desc, line.quantity, line.uom ?? null, line.unit_price ?? 0);
  logAudit(db, spotBuyId, "human", "Line added", `${line.material_desc} × ${line.quantity}${line.uom ? " " + line.uom : ""}`, { stage: "triage" });
  return Number(info.lastInsertRowid);
}

export function deleteSpotBuyLine(lineId: number): void {
  getDb().prepare("DELETE FROM spot_buy_lines WHERE id=?").run(lineId);
}

// ---- goods receipt & 3-way match (#13) ------------------------------------
export interface GoodsReceipt {
  id: number;
  spot_buy_id: number;
  po_id: number | null;
  quantity_ordered: number;
  quantity_received: number;
  partial: number;
  invoice_number: string | null;
  invoice_amount: number | null;
  po_amount: number | null;
  match_status: string;
  discrepancy_note: string | null;
  received_by_person_id: number | null;
  received_at: string;
}

export function goodsReceipts(spotBuyId: number): GoodsReceipt[] {
  return getDb()
    .prepare("SELECT * FROM goods_receipts WHERE spot_buy_id=? ORDER BY id")
    .all(spotBuyId) as GoodsReceipt[];
}

export interface RecordReceiptInput {
  spot_buy_id: number;
  quantity_received: number;
  invoice_number?: string | null;
  invoice_amount?: number | null;
  partial?: boolean;
}

export function recordGoodsReceipt(input: RecordReceiptInput, personId: number | null): number {
  const db = getDb();
  const sb = getSpotBuy(input.spot_buy_id)!;
  const po = db
    .prepare("SELECT * FROM purchase_orders WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(input.spot_buy_id) as PurchaseOrder | undefined;
  const req = db
    .prepare("SELECT * FROM requisitions WHERE spot_buy_id=? ORDER BY id DESC LIMIT 1")
    .get(input.spot_buy_id) as Requisition | undefined;
  const qtyOrdered = req?.quantity ?? sb.quantity;
  const poAmount = po?.total_value ?? req?.total_value ?? 0;

  // Sum prior receipts to know cumulative received (partial shipments #11).
  const priorReceived = (
    db.prepare("SELECT COALESCE(SUM(quantity_received),0) s FROM goods_receipts WHERE spot_buy_id=?").get(input.spot_buy_id) as { s: number }
  ).s;
  const cumulative = priorReceived + input.quantity_received;
  const isPartial = input.partial ?? cumulative + 1e-9 < qtyOrdered;

  // The 3-way match only runs once the order is fully received. A partial
  // shipment stays 'pending' (awaiting the remainder) rather than being flagged
  // as a quantity variance against the full order (#13).
  const match = isPartial
    ? "pending"
    : threeWayMatch({
        qtyOrdered,
        qtyReceived: cumulative,
        poAmount,
        invoiceAmount: input.invoice_amount ?? null,
      });
  const clean = match === "matched" || match === "pending";

  const info = db
    .prepare(
      `INSERT INTO goods_receipts (spot_buy_id,po_id,quantity_ordered,quantity_received,partial,invoice_number,invoice_amount,po_amount,match_status,discrepancy_note,received_by_person_id,received_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.spot_buy_id,
      po?.id ?? null,
      qtyOrdered,
      input.quantity_received,
      isPartial ? 1 : 0,
      input.invoice_number ?? null,
      input.invoice_amount ?? null,
      poAmount,
      match,
      clean ? null : MATCH_LABEL[match],
      personId,
      nowIso()
    );

  logAudit(
    db,
    input.spot_buy_id,
    "human",
    isPartial ? "Partial goods receipt" : "Goods received",
    `${input.quantity_received}${sb.uom ? " " + sb.uom : ""} received (${cumulative}/${qtyOrdered})${isPartial ? " — awaiting remainder" : `; ${MATCH_LABEL[match]}`}`,
    { personId, stage: "receiving" }
  );

  if (po && !isPartial && match === "matched") {
    db.prepare("UPDATE purchase_orders SET status='closed' WHERE id=?").run(po.id);
    setStatus(db, input.spot_buy_id, "closed");
    logAudit(db, input.spot_buy_id, "system", "Spot buy closed", "3-way match clean — receipt = PO = invoice", { stage: "closed" });
  } else if (!isPartial && match !== "matched") {
    logAudit(db, input.spot_buy_id, "system", "3-way match exception", MATCH_LABEL[match], { stage: "receiving" });
  }
  return Number(info.lastInsertRowid);
}

// ---- scheduled-job processor (#6) -----------------------------------------
export interface JobRunResult {
  processed: number;
  followUps: number;
  escalations: number;
}

// Run all jobs whose run_at has passed. Called by the /api/cron endpoint and the
// in-process ticker. Idempotent: a job that no longer applies is marked done.
export function processDueJobs(nowOverride?: string): JobRunResult {
  const db = getDb();
  const now = nowOverride ?? nowIso();
  const due = db
    .prepare("SELECT * FROM scheduled_jobs WHERE status='pending' AND run_at <= ? ORDER BY run_at")
    .all(now) as {
    id: number;
    kind: "rfq_followup" | "approval_escalation";
    spot_buy_id: number | null;
    ref_id: number | null;
  }[];

  const res: JobRunResult = { processed: 0, followUps: 0, escalations: 0 };
  for (const job of due) {
    try {
      if (job.kind === "rfq_followup" && job.ref_id != null) {
        const iv = db.prepare("SELECT status FROM rfq_invites WHERE id=?").get(job.ref_id) as { status: string } | undefined;
        if (iv && (iv.status === "invited" || iv.status === "followed_up")) {
          followUpInvite(job.ref_id);
          res.followUps++;
        }
      } else if (job.kind === "approval_escalation" && job.ref_id != null) {
        const ap = db.prepare("SELECT status FROM approvals WHERE id=?").get(job.ref_id) as { status: string } | undefined;
        if (ap && ap.status === "pending") {
          escalateApproval(job.ref_id);
          res.escalations++;
        }
      }
      db.prepare("UPDATE scheduled_jobs SET status='done', attempts=attempts+1, done_at=? WHERE id=?").run(nowIso(), job.id);
      res.processed++;
    } catch {
      db.prepare("UPDATE scheduled_jobs SET attempts=attempts+1 WHERE id=?").run(job.id);
    }
  }
  return res;
}

export function pendingJobs(): { id: number; kind: string; spot_buy_id: number | null; run_at: string }[] {
  return getDb()
    .prepare("SELECT id,kind,spot_buy_id,run_at FROM scheduled_jobs WHERE status='pending' ORDER BY run_at")
    .all() as any[];
}
