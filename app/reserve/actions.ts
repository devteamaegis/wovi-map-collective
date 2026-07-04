"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSpotBuy,
  confirmUrgency,
  draftRfq,
  updateRfqBody,
  toggleInvite,
  approveRfqSend,
  followUpInvite,
  simulateIncomingQuotes,
  addQuote,
  selectQuote,
  buildRequisition,
  updateRequisition,
  submitRequisition,
  decideApproval,
  escalateApproval,
  draftPo,
  releasePo,
  assembleCustoms,
  verifyCustoms,
  cancelSpotBuy,
  getSpotBuy,
  sodConflict,
  recordGoodsReceipt,
  addSpotBuyLine,
  deleteSpotBuyLine,
  processDueJobs,
  StaleWriteError,
  assertVersion,
} from "@/lib/repos/reserve";
import type { SpotBuyTrigger, Urgency, Metal } from "@/lib/reserve/types";
import {
  rotateApiToken,
  setSetting,
  notify,
  importVendorsCsv,
  addDoaRule,
  deleteDoaRule,
  addChannel,
  deleteChannel,
  setChannelEnabled,
  deliverPendingEmails,
  isSafeWebhookUrl,
  type VendorImportResult,
  type OutboxChannel,
} from "@/lib/repos/settings";
import { upsertFxRate } from "@/lib/repos/fx";
import { parseQuoteText, type ParseResult } from "@/lib/repos/quote-ai";
import { saveAttachment, deleteAttachment, type AttachmentKind } from "@/lib/repos/attachments";
import { currentUser, requireUser, AuthError } from "@/lib/auth";
import { getDb } from "@/lib/db";

function rall() {
  revalidatePath("/", "layout");
}
function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
// The acting directory-person is derived from the session, never trusted from
// the client — this is what makes attribution and SoD real.
async function actorPid(): Promise<number | null> {
  const u = await currentUser();
  return u?.person_id ?? null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ---- create -----------------------------------------------------------------
export async function createSpotBuyAction(formData: FormData) {
  const pid = await actorPid();
  const id = createSpotBuy({
    title: String(formData.get("title") || "").trim(),
    material_number: ((formData.get("material_number") as string) || "").trim() || null,
    material_desc: ((formData.get("material_desc") as string) || "").trim() || null,
    quantity: num(formData.get("quantity")) ?? 0,
    uom: ((formData.get("uom") as string) || "").trim() || null,
    required_by: ((formData.get("required_by") as string) || "").trim() || null,
    cost_center: ((formData.get("cost_center") as string) || "").trim() || null,
    plant: ((formData.get("plant") as string) || "").trim() || null,
    trigger: (formData.get("trigger") as SpotBuyTrigger) || "shortage",
    urgency: (formData.get("urgency") as Urgency) || "high",
    downtime_cost_per_hour: num(formData.get("downtime_cost_per_hour")) ?? 0,
    buyer_org_id: num(formData.get("buyer_org_id")),
    buyer_person_id: num(formData.get("buyer_person_id")) ?? pid,
    cross_border: formData.get("cross_border") === "on",
    metal: (formData.get("metal") as Metal) || "none",
    ship_from_country: ((formData.get("ship_from_country") as string) || "").trim() || null,
    ship_to_country: ((formData.get("ship_to_country") as string) || "").trim() || null,
    incoterm: ((formData.get("incoterm") as string) || "").trim() || null,
  });
  rall();
  redirect(`/reserve/${id}`);
}

// ---- pipeline actions (actor from session) ---------------------------------
export async function confirmUrgencyAction(spotBuyId: number, _personId?: number | null) {
  confirmUrgency(spotBuyId, await actorPid());
  rall();
}
export async function draftRfqAction(spotBuyId: number) {
  draftRfq(spotBuyId);
  rall();
}
export async function updateRfqBodyAction(rfqId: number, body: string) {
  updateRfqBody(rfqId, body);
  rall();
}
export async function toggleInviteAction(rfqId: number, supplierOrgId: number, on: boolean) {
  toggleInvite(rfqId, supplierOrgId, on);
  rall();
}
export async function approveRfqSendAction(rfqId: number, _personId?: number | null) {
  approveRfqSend(rfqId, await actorPid());
  await deliverPendingEmails();
  rall();
}
export async function followUpInviteAction(inviteId: number) {
  followUpInvite(inviteId);
  await deliverPendingEmails();
  rall();
}
export async function simulateQuotesAction(spotBuyId: number) {
  simulateIncomingQuotes(spotBuyId);
  rall();
}
export interface AddQuoteActionInput {
  spot_buy_id: number;
  supplier_org_id: number;
  unit_price: number;
  quantity: number;
  lead_time_days: number;
  freight_cost: number;
  freight_mode?: string | null;
  source_format?: string | null;
  currency?: string;
  incoterm?: string | null;
  moq?: number | null;
  notes?: string | null;
}
export async function addQuoteAction(input: AddQuoteActionInput) {
  addQuote(input);
  rall();
}
// Parse a pasted supplier quote into structured fields (#3) — not committed.
export async function parseQuoteAction(text: string): Promise<ParseResult> {
  return parseQuoteText(text);
}
export async function selectQuoteAction(quoteId: number, _personId?: number | null) {
  selectQuote(quoteId, await actorPid());
  rall();
}
export async function buildRequisitionAction(spotBuyId: number) {
  buildRequisition(spotBuyId);
  rall();
}
export async function updateRequisitionAction(
  reqId: number,
  input: { material_number?: string | null; cost_center?: string | null; need_by?: string | null; quantity?: number }
) {
  updateRequisition(reqId, input);
  rall();
}
export async function submitRequisitionAction(reqId: number, _personId?: number | null) {
  const pid = await actorPid();
  submitRequisition(reqId, pid);
  const db = getDb();
  const req = db
    .prepare("SELECT spot_buy_id, total_value, currency FROM requisitions WHERE id=?")
    .get(reqId) as { spot_buy_id: number; total_value: number; currency: string } | undefined;
  if (req) {
    const sb = getSpotBuy(req.spot_buy_id);
    await notify(
      `🕐 Approval needed — ${sb?.ref} “${sb?.title}” (${req.total_value.toLocaleString("en-US", { style: "currency", currency: req.currency || "USD" })})`,
      req.spot_buy_id,
      "approval_needed"
    );
    await deliverPendingEmails();
  }
  rall();
}

// SoD- and role-enforced approval decision (#1). Returns a structured result so
// the UI can surface a block instead of crashing.
export async function decideApprovalAction(
  approvalId: number,
  decision: "approved" | "rejected",
  _personId?: number | null,
  note?: string | null
): Promise<ActionResult> {
  let me;
  try {
    me = await requireUser(["approver", "admin"]);
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, error: "Your role can't approve requisitions — an approver or admin must sign off." };
    throw e;
  }
  const conflict = sodConflict(approvalId, me.person_id);
  if (conflict != null) {
    return {
      ok: false,
      error: "Segregation of duties: you submitted this requisition, so you can't also approve it. Route it to another approver.",
    };
  }
  decideApproval(approvalId, decision, me.person_id, note ?? null);
  const db = getDb();
  const a = db
    .prepare("SELECT spot_buy_id, amount FROM approvals WHERE id=?")
    .get(approvalId) as { spot_buy_id: number; amount: number } | undefined;
  if (a) {
    const sb = getSpotBuy(a.spot_buy_id);
    await notify(
      `${decision === "approved" ? "✅ Approved" : "❌ Rejected"} — ${sb?.ref} “${sb?.title}” (${a.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })})`,
      a.spot_buy_id,
      decision === "approved" ? "approved" : "rejected"
    );
    await deliverPendingEmails();
  }
  rall();
  return { ok: true };
}
export async function escalateApprovalAction(approvalId: number): Promise<ActionResult> {
  try {
    await requireUser(["approver", "admin"]);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "Only an approver or admin can escalate." };
    throw e;
  }
  escalateApproval(approvalId);
  rall();
  return { ok: true };
}
export async function draftPoAction(spotBuyId: number) {
  draftPo(spotBuyId);
  rall();
}
export async function releasePoAction(poId: number, _personId?: number | null) {
  releasePo(poId, await actorPid());
  await deliverPendingEmails();
  rall();
}
export async function assembleCustomsAction(spotBuyId: number) {
  assembleCustoms(spotBuyId);
  rall();
}
export async function verifyCustomsAction(packetId: number, _personId?: number | null) {
  verifyCustoms(packetId, await actorPid());
  rall();
}
export async function cancelSpotBuyAction(spotBuyId: number, _personId?: number | null) {
  cancelSpotBuy(spotBuyId, await actorPid());
  rall();
}

// ---- goods receipt & 3-way match (#13) -------------------------------------
export async function recordReceiptAction(input: {
  spot_buy_id: number;
  quantity_received: number;
  invoice_number?: string | null;
  invoice_amount?: number | null;
  partial?: boolean;
}) {
  recordGoodsReceipt(input, await actorPid());
  rall();
}

// ---- multi-line (#11) ------------------------------------------------------
export async function addLineAction(
  spotBuyId: number,
  line: { material_number?: string | null; material_desc: string; quantity: number; uom?: string | null; unit_price?: number }
) {
  addSpotBuyLine(spotBuyId, line);
  rall();
}
export async function deleteLineAction(lineId: number) {
  deleteSpotBuyLine(lineId);
  rall();
}

// ---- attachments (#9) ------------------------------------------------------
export async function uploadAttachmentAction(formData: FormData): Promise<ActionResult> {
  const me = await currentUser();
  const file = formData.get("file") as File | null;
  const spotBuyId = num(formData.get("spot_buy_id"));
  const kind = (String(formData.get("kind") || "other") as AttachmentKind);
  if (!file || file.size === 0) return { ok: false, error: "No file selected." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "File exceeds 15 MB limit." };
  const bytes = Buffer.from(await file.arrayBuffer());
  saveAttachment({
    spot_buy_id: spotBuyId,
    kind,
    filename: file.name,
    mime: file.type || null,
    bytes,
    uploaded_by_user_id: me?.id ?? null,
  });
  rall();
  return { ok: true };
}
export async function deleteAttachmentAction(id: number) {
  deleteAttachment(id);
  rall();
}

// ---- integrations ------------------------------------------------------------
export async function rotateApiTokenAction(): Promise<string> {
  await requireUser(["admin"]);
  const token = rotateApiToken();
  rall();
  return token;
}
export async function saveSlackUrlAction(url: string): Promise<ActionResult> {
  await requireUser(["admin"]);
  const clean = url.trim();
  if (clean && !isSafeWebhookUrl(clean)) return { ok: false, error: "That URL is blocked (must be a public https host)." };
  setSetting("slack_webhook_url", clean || null);
  rall();
  return { ok: true };
}
export async function testSlackAction(): Promise<"sent" | "failed" | "logged"> {
  const status = await notify("👋 Test from Wovi Reserve — your connector is working.", null, "test");
  rall();
  return status;
}
export async function importVendorsAction(csv: string): Promise<VendorImportResult> {
  await requireUser(["admin", "broker"]);
  const result = importVendorsCsv(csv);
  rall();
  return result;
}
export async function addDoaRuleAction(
  role: string,
  minAmount: number,
  maxAmount: number | null,
  approverPersonId: number | null
) {
  await requireUser(["admin"]);
  addDoaRule(role, minAmount, maxAmount, approverPersonId);
  rall();
}
export async function deleteDoaRuleAction(id: number) {
  await requireUser(["admin"]);
  deleteDoaRule(id);
  rall();
}

// ---- notification channels (#12) -------------------------------------------
export async function addChannelAction(input: { label: string; channel: OutboxChannel; target: string; events: string[] }): Promise<ActionResult> {
  await requireUser(["admin"]);
  if (!isSafeWebhookUrl(input.target)) return { ok: false, error: "That webhook URL is blocked (must be a public https host)." };
  addChannel(input);
  rall();
  return { ok: true };
}
export async function setChannelEnabledAction(id: number, enabled: boolean) {
  await requireUser(["admin"]);
  setChannelEnabled(id, enabled);
  rall();
}
export async function deleteChannelAction(id: number) {
  await requireUser(["admin"]);
  deleteChannel(id);
  rall();
}

// ---- FX rates (#11) --------------------------------------------------------
export async function upsertFxRateAction(currency: string, rate: number) {
  await requireUser(["admin"]);
  upsertFxRate(currency, rate);
  rall();
}

// ---- scheduler (#6) — run due jobs now (manual trigger from the UI) ---------
export async function runDueJobsAction(): Promise<{ processed: number; followUps: number; escalations: number }> {
  const r = processDueJobs();
  await deliverPendingEmails();
  rall();
  return r;
}
