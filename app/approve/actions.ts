"use server";

import { revalidatePath } from "next/cache";
import { verifyApprovalToken } from "@/lib/reserve/token";
import { getDb } from "@/lib/db";
import { decideApproval, getSpotBuy, sodConflict } from "@/lib/repos/reserve";
import { notify, deliverPendingEmails } from "@/lib/repos/settings";

export interface TokenActResult {
  ok: boolean;
  error?: string;
  decision?: "approved" | "rejected";
  ref?: string;
}

// Act on a signed approval magic-link (#10). The token itself is the authorization
// (issued only to the routed approver); the approval must still be pending, which
// makes the link naturally single-use.
export async function actOnTokenAction(token: string): Promise<TokenActResult> {
  const payload = verifyApprovalToken(token);
  if (!payload) return { ok: false, error: "This link is invalid or has expired." };

  const db = getDb();
  const a = db
    .prepare("SELECT id, spot_buy_id, approver_person_id, status FROM approvals WHERE id=?")
    .get(payload.a) as { id: number; spot_buy_id: number; approver_person_id: number | null; status: string } | undefined;
  if (!a) return { ok: false, error: "Approval not found." };
  if (a.status !== "pending") {
    return { ok: false, error: `Already ${a.status}. No further action needed.` };
  }

  // Segregation of duties applies to the magic-link path too (#1): the routed
  // approver must not be the person who submitted the requisition.
  if (sodConflict(a.id, a.approver_person_id) != null) {
    return {
      ok: false,
      error: "Segregation of duties: the submitter can't approve their own requisition. It needs a different approver.",
    };
  }

  // Attribute the decision to the approver the link was issued to.
  decideApproval(a.id, payload.d, a.approver_person_id, "Decided via secure mobile link");
  const sb = getSpotBuy(a.spot_buy_id);
  await notify(
    `${payload.d === "approved" ? "✅ Approved" : "❌ Rejected"} (mobile) — ${sb?.ref} “${sb?.title}”`,
    a.spot_buy_id,
    payload.d === "approved" ? "approved" : "rejected"
  );
  await deliverPendingEmails();
  revalidatePath("/", "layout");
  return { ok: true, decision: payload.d, ref: sb?.ref };
}
