"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({
  onDelete,
  label = "Delete",
  confirmText = "This will remove the record and its edges. Continue?",
}: {
  onDelete: () => Promise<unknown>;
  label?: string;
  confirmText?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[12px] text-ink-3">{confirmText}</span>
        <button
          onClick={() => startTransition(() => void onDelete())}
          disabled={pending}
          className="btn btn-danger btn-sm"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="btn btn-danger btn-sm">
      <Trash2 size={13} /> {label}
    </button>
  );
}
