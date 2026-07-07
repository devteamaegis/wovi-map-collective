"use client";

import { useEffect, useRef } from "react";
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
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // While open: lock body scroll, move focus into the panel, trap Tab, and
  // restore focus to the previously-focused element on close.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    items?.[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !items || !items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, [open]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 ${
        open ? "" : "opacity-0"
      }`}
      inert={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[#12171f]/25 transition-opacity ${
          open ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : "Details"}
        aria-labelledby={title ? "drawer-title" : undefined}
        className={`absolute right-0 top-0 h-full ${width} max-w-[92vw] transform overflow-y-auto border-l border-rule bg-white shadow-panel transition-transform duration-200 ${
          open ? "pointer-events-auto translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rule bg-white px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? (
              <h3 id="drawer-title" className="serif text-lg leading-tight text-ink">{title}</h3>
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
