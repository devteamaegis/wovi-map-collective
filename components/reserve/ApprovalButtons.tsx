"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowUpRight, ShieldAlert } from "lucide-react";
import {
  decideApprovalAction,
  escalateApprovalAction,
} from "@/app/reserve/actions";

export function ApprovalButtons({
  approvalId,
  approverPersonId,
  compact = false,
}: {
  approvalId: number;
  approverPersonId: number | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const size = compact ? "btn-sm" : "";

  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      setError(null);
      const res = await decideApprovalAction(approvalId, decision, approverPersonId);
      if (res && !res.ok) setError(res.error ?? "Not permitted.");
      else router.refresh();
    });
  const escalate = () =>
    start(async () => {
      setError(null);
      const res = await escalateApprovalAction(approvalId);
      if (res && !res.ok) setError(res.error ?? "Not permitted.");
      else router.refresh();
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => decide("approved")} disabled={pending} className={`btn btn-good ${size}`}>
          <Check size={14} /> Approve
        </button>
        <button onClick={() => decide("rejected")} disabled={pending} className={`btn btn-danger ${size}`}>
          <X size={14} /> Reject
        </button>
        <button
          onClick={escalate}
          disabled={pending}
          className={`btn btn-ghost ${size}`}
          title="Approver unavailable — auto-escalate to next authority"
        >
          <ArrowUpRight size={14} /> Escalate
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#e7d4b6] bg-[#f6ecdc] px-2.5 py-1.5 text-[12px] leading-snug text-[#8a5d21]">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
