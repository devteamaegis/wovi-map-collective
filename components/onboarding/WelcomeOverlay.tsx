"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { WELCOME_STEPS } from "./steps";
import { WelcomeVisual } from "./WelcomeVisual";

export type WelcomeExit = "tour" | "enter" | "skip";

export function WelcomeOverlay({
  onExit,
}: {
  onExit: (action: WelcomeExit) => void;
}) {
  const [i, setI] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const total = WELCOME_STEPS.length;
  const step = WELCOME_STEPS[i];
  const isLast = i === total - 1;

  const next = useCallback(() => {
    setI((v) => Math.min(v + 1, total - 1));
  }, [total]);
  const back = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  // Keyboard: arrows / enter / esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit("skip");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!isLast) next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Enter") {
        if (isLast) {
          e.preventDefault();
          onExit("tour");
        } else {
          e.preventDefault();
          next();
        }
      } else if (e.key === "Tab") {
        // focus trap
        const root = containerRef.current;
        if (!root) return;
        const f = root.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isLast, next, back, onExit]);

  // Lock body scroll, move focus into the dialog on open, and restore it on close
  // (the Tab handler below only traps once focus is already inside).
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    containerRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Wovi"
      className="ob-overlay fixed inset-0 z-[70] flex flex-col bg-navy text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -50 && !isLast) next();
        else if (dx > 50) back();
        touchX.current = null;
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
        <span className="serif text-xl tracking-tight">Wovi</span>
        <button
          onClick={() => onExit("skip")}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-white/55 transition-colors hover:bg-white/5 hover:text-white"
        >
          Skip intro <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 items-center px-5 pb-4 sm:px-8">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Visual */}
          <div
            key={`v-${step.id}`}
            className="order-1 flex h-[180px] items-center justify-center sm:h-[240px] lg:order-2 lg:h-[320px]"
          >
            <WelcomeVisual variant={step.variant} />
          </div>

          {/* Copy */}
          <div key={`c-${step.id}`} className="order-2 lg:order-1">
            <span className="eyebrow eyebrow--light">{step.eyebrow}</span>
            <h2 className="serif ob-fade-up mt-4 text-[30px] leading-[1.12] tracking-tight sm:text-[40px]">
              {step.title.map((seg, k) =>
                seg.em ? (
                  <span key={k} className="italic text-accent-2">
                    {seg.t}
                  </span>
                ) : (
                  <span key={k}>{seg.t}</span>
                )
              )}
            </h2>
            <p
              className="ob-fade-up mt-4 max-w-md text-[15px] leading-relaxed text-white/65"
              style={{ animationDelay: "80ms" }}
            >
              {step.body}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: progress + nav */}
      <div className="px-5 pb-7 pt-2 sm:px-8 sm:pb-9">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* progress */}
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {WELCOME_STEPS.map((_, k) => (
                <button
                  key={k}
                  aria-label={`Go to step ${k + 1}`}
                  aria-current={k === i}
                  onClick={() => setI(k)}
                  className="group flex h-6 min-w-6 items-center justify-center px-0.5" /* 24x24 min tap target (WCAG 2.5.8) */
                >
                  <span
                    className={`block h-1 rounded-full transition-all ${
                      k === i ? "w-7 bg-accent-2" : "w-3 bg-white/20 group-hover:bg-white/35"
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="mono text-[11px] text-white/55">
              {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>

          {/* nav */}
          <div className="flex items-center gap-2.5">
            {i > 0 ? (
              <button
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft size={14} /> Back
              </button>
            ) : null}

            {isLast ? (
              <>
                <button
                  onClick={() => onExit("enter")}
                  className="rounded-lg px-2 py-2 text-[13px] text-white/60 transition-colors hover:text-white/90"
                >
                  Skip — I&apos;ll explore
                </button>
                <button
                  onClick={() => onExit("tour")}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white shadow-panel transition-colors hover:bg-[#3f5f7f]"
                >
                  Take the tour <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#3f5f7f]"
              >
                {step.cta} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
