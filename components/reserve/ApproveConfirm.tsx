"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { actOnTokenAction, type TokenActResult } from "@/app/approve/actions";

export function ApproveConfirm({
  token,
  decision,
}: {
  token: string;
  decision: "approved" | "rejected";
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TokenActResult | null>(null);

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-[#c5ddd4] bg-[#e4efea] px-4 py-3 text-center text-[#2c5d4e]">
        <Check size={20} className="mx-auto mb-1" />
        <p className="text-sm font-medium">
          {result.ref} {result.decision === "approved" ? "approved" : "rejected"}.
        </p>
        <p className="mt-0.5 text-[12px]">Recorded in the audit trail. You can close this window.</p>
      </div>
    );
  }

  const isApprove = decision === "approved";
  return (
    <div>
      <button
        onClick={() =>
          start(async () => {
            const r = await actOnTokenAction(token);
            setResult(r);
          })
        }
        disabled={pending}
        className={`btn w-full ${isApprove ? "btn-good" : "btn-danger"}`}
      >
        {isApprove ? <Check size={15} /> : <X size={15} />}
        {pending ? "Working…" : `Confirm ${isApprove ? "approval" : "rejection"}`}
      </button>
      {result && !result.ok ? (
        <p className="mt-3 rounded-lg border border-[#e7d4b6] bg-[#f6ecdc] px-3 py-2 text-[13px] text-[#8a5d21]">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
