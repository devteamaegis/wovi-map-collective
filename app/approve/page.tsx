import { verifyApprovalToken } from "@/lib/reserve/token";
import { getDb } from "@/lib/db";
import { fmtMoney } from "@/lib/reserve/logic";
import { AuthCard } from "@/components/auth/AuthCard";
import { ApproveConfirm } from "@/components/reserve/ApproveConfirm";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const payload = token ? verifyApprovalToken(token) : null;

  if (!token || !payload) {
    return (
      <AuthCard title="Link expired" subtitle="This approval link is invalid or has expired. Open Reserve to review the request.">
        <a href="/reserve/approvals" className="btn btn-primary w-full">Go to approvals</a>
      </AuthCard>
    );
  }

  const db = getDb();
  const a = db
    .prepare(
      `SELECT a.amount, a.role, a.status, s.ref, s.title, s.urgency, o.name AS buyer
       FROM approvals a JOIN spot_buys s ON s.id=a.spot_buy_id
       LEFT JOIN organizations o ON o.id=s.buyer_org_id WHERE a.id=?`
    )
    .get(payload.a) as
    | { amount: number; role: string | null; status: string; ref: string; title: string; urgency: string; buyer: string | null }
    | undefined;

  if (!a) {
    return (
      <AuthCard title="Not found" subtitle="This approval no longer exists.">
        <a href="/reserve/approvals" className="btn w-full">Go to approvals</a>
      </AuthCard>
    );
  }

  const verb = payload.d === "approved" ? "Approve" : "Reject";
  return (
    <AuthCard
      title={`${verb} ${a.ref}?`}
      subtitle="You're signing off from a secure mobile link. This action is attributed to you and recorded in the audit trail."
    >
      <div className="rounded-xl border border-rule bg-paper-2 px-4 py-3">
        <p className="font-medium text-ink">{a.title}</p>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {a.buyer ?? "—"} · {a.role ?? "Approver"} band
        </p>
        <p className="serif mt-2 text-2xl text-ink">{fmtMoney(a.amount)}</p>
      </div>
      {a.status !== "pending" ? (
        <p className="mt-4 rounded-lg border border-rule bg-white px-3 py-2 text-[13px] text-ink-2">
          Already <strong>{a.status}</strong> — no further action needed.
        </p>
      ) : (
        <div className="mt-4">
          <ApproveConfirm token={token} decision={payload.d} />
        </div>
      )}
    </AuthCard>
  );
}
