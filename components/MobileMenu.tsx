"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./NavLinks";
import { NetworkMotif } from "./NetworkMotif";
import { TourButton } from "./onboarding/TourButton";

// Mobile navigation: a hamburger (in TopBar, hidden at lg) opening a left
// slide-in drawer that mirrors the desktop sidebar. The desktop sidebar stays
// untouched; this only appears below 1024px.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the drawer on open, trap Tab, and restore focus on close.
  useEffect(() => {
    if (!open) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>("a[href],button");
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
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="btn btn-ghost btn-sm -ml-1 shrink-0 lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-[#12171f]/40 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Drawer — inert when closed so its off-screen links leave the tab order */}
      <aside
        ref={panelRef}
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[320px] flex-col bg-navy text-white shadow-panel transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex items-start justify-between px-5 pb-5 pt-6">
          <NetworkMotif className="pointer-events-none absolute -right-6 top-2 w-40 opacity-30" />
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="relative inline-flex flex-col"
          >
            <span className="serif text-2xl tracking-tight">Wovi</span>
            <span className="eyebrow eyebrow--light mt-2">Broker Console</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="relative -mr-2 rounded-md p-1.5 text-white/55 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 py-2" data-tour="sidebar-nav">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>

        <div className="mt-auto space-y-3 px-5 pb-6 pt-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="serif text-[13px] leading-snug text-white/85">
              The manual work is{" "}
              <span className="italic text-accent-2">the moat.</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
              Every consented intro compounds into the graph.
            </p>
          </div>
          <TourButton onClick={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
