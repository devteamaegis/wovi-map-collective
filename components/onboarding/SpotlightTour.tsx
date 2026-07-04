"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { TOUR_STOPS } from "./steps";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Viewport-based visibility so it works for position:fixed elements (whose
// offsetParent is null) like the mobile graph filter sheet — and correctly
// treats off-screen/translated-away targets (closed sheet, closed nav) as hidden.
function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
    return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Must be at least partially within the viewport.
  return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}

export function SpotlightTour({ onExit }: { onExit: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [coach, setCoach] = useState<{ top: number; left: number } | null>(null);
  const targetRef = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const total = TOUR_STOPS.length;
  const stop = TOUR_STOPS[i];
  const isLast = i === total - 1;

  const next = useCallback(() => setI((v) => Math.min(v + 1, total - 1)), [total]);
  const back = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected || !isVisible(el)) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  // Navigate to the stop's route if we're not already there.
  useEffect(() => {
    if (pathname !== stop.route) router.push(stop.route);
  }, [i, pathname, stop.route, router]);

  // Once on the right route, wait for the target, measure, and reveal. Re-runs
  // when the route settles (pathname change) so cross-page stops never strand.
  // Uses setTimeout (not rAF — rAF is throttled in some headless/background
  // renderers, which would leave the tour stuck).
  useEffect(() => {
    setReady(false);
    setRect(null);
    setCoach(null);
    targetRef.current = null;
    if (pathname !== stop.route) return; // wait for the navigate effect

    // Ask the graph to open its mobile filter sheet so this stop can spotlight it
    // (no-op on desktop, where the panel is always visible).
    if (stop.target === "graph-filters") {
      window.dispatchEvent(new CustomEvent("wovi:open-graph-filters"));
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const attempt = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${stop.target}"]`);
      if (el && isVisible(el)) {
        targetRef.current = el;
        const r = el.getBoundingClientRect();
        if (r.top < 60 || r.bottom > window.innerHeight - 60) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        timer = setTimeout(() => {
          if (cancelled) return;
          measure();
          setReady(true);
        }, 180);
        return;
      }
      if (Date.now() - startedAt > 2500) {
        // Target never appeared (e.g. hidden on this layout) → centered card.
        targetRef.current = null;
        setRect(null);
        setReady(true);
        return;
      }
      timer = setTimeout(attempt, 60);
    };

    timer = setTimeout(attempt, 30);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [i, pathname, stop.route, stop.target, measure]);

  // Keep the rect synced to layout changes.
  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        isLast ? onExit() : next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isLast, next, back, onExit]);

  // Position the coachmark card relative to the spotlight (or center it).
  useLayoutEffect(() => {
    if (!ready) return;
    const card = cardRef.current;
    const cardW = card?.offsetWidth ?? 320;
    const cardH = card?.offsetHeight ?? 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 14;

    let top: number;
    let left: number;

    const narrow = vw < 700;
    if (!rect || stop.placement === "center") {
      left = vw / 2 - cardW / 2;
      top = vh / 2 - cardH / 2;
    } else if (narrow) {
      // On phones, keep the card clear of the target: if the target sits in the
      // lower half (e.g. the filter bottom sheet), float the card to the top;
      // otherwise place it just below the target.
      left = vw / 2 - cardW / 2;
      const targetMidY = rect.top + rect.height / 2;
      if (targetMidY > vh / 2) {
        top = 68; // below the sticky top bar
      } else {
        const below = rect.top + rect.height + M;
        top = below + cardH < vh - 12 ? below : vh - cardH - 16;
      }
    } else {
      switch (stop.placement) {
        case "bottom":
          top = rect.top + rect.height + M;
          left = rect.left + rect.width / 2 - cardW / 2;
          break;
        case "top":
          top = rect.top - cardH - M;
          left = rect.left + rect.width / 2 - cardW / 2;
          break;
        case "right":
          left = rect.left + rect.width + M;
          top = rect.top + rect.height / 2 - cardH / 2;
          break;
        case "left":
          left = rect.left - cardW - M;
          top = rect.top + rect.height / 2 - cardH / 2;
          break;
        default:
          left = vw / 2 - cardW / 2;
          top = vh / 2 - cardH / 2;
      }
    }
    left = Math.max(8, Math.min(left, vw - cardW - 8));
    top = Math.max(8, Math.min(top, vh - cardH - 8));
    setCoach({ top, left });
  }, [ready, rect, i, stop.placement]);

  const PAD = 6;

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Click-catcher (blocks the app while guiding) */}
      <div className="absolute inset-0" />

      {/* Spotlight hole OR full dim */}
      {rect ? (
        <div
          className="ob-spotlight pointer-events-none absolute rounded-xl"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#0e131a]/70" />
      )}

      {/* Coachmark */}
      {ready ? (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={stop.title}
          className="ob-coach absolute w-[88vw] max-w-[330px] rounded-xl border border-rule bg-white p-4 shadow-panel"
          style={coach ? { top: coach.top, left: coach.left } : { opacity: 0 }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="eyebrow">
              Step {i + 1} of {total}
            </span>
            <button
              onClick={onExit}
              aria-label="End tour"
              className="-mr-1 -mt-1 rounded-md p-1 text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
          <h3 className="serif mt-2 text-lg leading-snug text-ink">{stop.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{stop.body}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STOPS.map((_, k) => (
                <span
                  key={k}
                  className={`h-1 w-1.5 rounded-full ${
                    k === i ? "w-4 bg-accent" : "bg-rule"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {i > 0 ? (
                <button onClick={back} className="btn btn-ghost btn-sm">
                  <ArrowLeft size={13} /> Back
                </button>
              ) : null}
              <button
                onClick={() => (isLast ? onExit() : next())}
                className="btn btn-primary btn-sm"
              >
                {isLast ? "Done" : "Next"}
                {!isLast ? <ArrowRight size={13} /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
