"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = "w-[380px]",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  eyebrow?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 ${
        open ? "" : "opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[#12171f]/25 transition-opacity ${
          open ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 h-full ${width} max-w-[92vw] transform overflow-y-auto border-l border-rule bg-white shadow-panel transition-transform duration-200 ${
          open ? "pointer-events-auto translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rule bg-white px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? (
              <h3 className="serif text-lg leading-tight text-ink">{title}</h3>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm -mr-2 shrink-0"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
