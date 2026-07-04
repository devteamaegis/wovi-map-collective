"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Undo2 } from "lucide-react";
import { decideConsentAction } from "@/app/actions";
import type { ConsentRecordStatus } from "@/lib/types";

export function ConsentButtons({
  consentId,
  status,
  compact = false,
}: {
  consentId: number;
  status: ConsentRecordStatus;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const decide = (next: ConsentRecordStatus) => {
    startTransition(async () => {
      const res = await decideConsentAction(consentId, next);
      if (res?.pathReachedDoubleOptIn) {
        setFlash("Double opt-in reached — intro recorded");
      }
      router.refresh();
    });
  };

  const size = compact ? "btn-sm" : "";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "granted" ? (
        <button
          onClick={() => decide("granted")}
          disabled={pending}
          className={`btn btn-good ${size}`}
        >
          <Check size={13} /> Grant
        </button>
      ) : null}
      {status !== "refused" ? (
        <button
          onClick={() => decide("refused")}
          disabled={pending}
          className={`btn btn-danger ${size}`}
        >
          <X size={13} /> Refuse
        </button>
      ) : null}
      {status === "granted" || status === "refused" ? (
        <button
          onClick={() => decide("revoked")}
          disabled={pending}
          className={`btn btn-ghost ${size}`}
          title="Revoke / reset"
        >
          <Undo2 size={13} /> Revoke
        </button>
      ) : null}
      {flash ? (
        <span className="text-[11px] font-medium text-good">{flash}</span>
      ) : null}
    </div>
  );
}
