"use client";

import { Building2, User, Check, ArrowRight } from "lucide-react";
import { NetworkMotif } from "@/components/NetworkMotif";
import type { WelcomeVariant } from "./steps";

// On-brand SVG/markup illustrations for each welcome step. Light tones on navy.
// Subtle entrance animations (ob-fade-up) are disabled under reduced-motion via
// globals.css. Each visual remounts per step so its animation replays.

function Chip({
  icon: Icon,
  label,
  delay = 0,
}: {
  icon: typeof Building2;
  label: string;
  delay?: number;
}) {
  return (
    <span
      className="ob-fade-up inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Icon size={13} className="text-accent-2" />
      <span className="text-[13px] font-medium text-white/90">{label}</span>
    </span>
  );
}

export function WelcomeVisual({ variant }: { variant: WelcomeVariant }) {
  if (variant === "intro" || variant === "compounds") {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <NetworkMotif
          light
          className="ob-fade-up w-[520px] max-w-[92%] opacity-60"
        />
        {variant === "compounds" ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
            {[60, 78, 92].map((v, i) => (
              <div
                key={i}
                className="ob-fade-up flex w-20 items-center gap-1.5"
                style={{ animationDelay: `${300 + i * 140}ms` }}
              >
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="ob-grow h-full rounded-full bg-[#74b08f]"
                    style={{ width: `${v}%` }}
                  />
                </div>
                <span className="mono text-[10px] text-white/50">{v}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "gap") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg
          viewBox="0 0 420 200"
          className="w-[440px] max-w-[94%]"
          fill="none"
          aria-hidden
        >
          {/* Left: a dead ledger */}
          {[0, 1, 2, 3, 4].map((r) => (
            <rect
              key={r}
              x="20"
              y={48 + r * 22}
              width="140"
              height="9"
              rx="2"
              fill="rgba(174,196,220,0.18)"
              className="ob-fade-up"
              style={{ animationDelay: `${r * 60}ms` } as React.CSSProperties}
            />
          ))}
          <text
            x="20"
            y="34"
            className="mono"
            fontSize="9"
            letterSpacing="2"
            fill="rgba(200,216,234,0.5)"
          >
            PAST
          </text>

          {/* Right: a living graph */}
          <g
            className="ob-fade-up"
            style={{ animationDelay: "320ms" } as React.CSSProperties}
          >
            {[
              [300, 60],
              [360, 90],
              [320, 130],
              [270, 105],
              [340, 150],
            ].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={i === 1 ? 6 : 4}
                fill={i === 1 ? "#9fc0e0" : "rgba(110,147,182,0.85)"}
              />
            ))}
            {[
              [300, 60, 360, 90],
              [360, 90, 320, 130],
              [320, 130, 270, 105],
              [320, 130, 340, 150],
              [270, 105, 300, 60],
            ].map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(143,176,208,0.5)"
                strokeWidth="1.2"
              />
            ))}
          </g>
          <text
            x="262"
            y="34"
            className="mono"
            fontSize="9"
            letterSpacing="2"
            fill="rgba(159,192,224,0.8)"
          >
            WHAT&apos;S POSSIBLE
          </text>

          {/* divider gap */}
          <line
            x1="210"
            y1="30"
            x2="210"
            y2="170"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
        </svg>
      </div>
    );
  }

  if (variant === "idea") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Chip icon={Building2} label="Voltaic Motors" delay={0} />
          <span
            className="ob-fade-up flex flex-col items-center px-1"
            style={{ animationDelay: "160ms" }}
          >
            <span className="mono text-[10px] leading-none text-accent-2">82</span>
            <ArrowRight size={14} className="text-white/40" />
          </span>
          <Chip icon={User} label="Raj Malhotra" delay={220} />
          <span
            className="ob-fade-up flex flex-col items-center px-1"
            style={{ animationDelay: "380ms" }}
          >
            <span className="mono text-[10px] leading-none text-accent-2">95</span>
            <ArrowRight size={14} className="text-white/40" />
          </span>
          <Chip icon={Building2} label="Sahel Lithium" delay={440} />
        </div>
        <p
          className="ob-fade-up mono mt-3 text-[10px] uppercase tracking-[0.16em] text-white/35"
          style={{ animationDelay: "620ms" }}
        >
          you → a connector → a supplier
        </p>
      </div>
    );
  }

  if (variant === "loop") {
    const LOOP = [
      ["01", "One need", "stated plainly"],
      ["02", "One useful path", "a single trusted route"],
      ["03", "Double opt-in", "both sides consent"],
      ["04", "Outcome compounds", "the graph strengthens"],
    ];
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="grid grid-cols-2 gap-2.5">
          {LOOP.map(([n, a, b], i) => (
            <div
              key={n}
              className="ob-fade-up rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
              style={{ animationDelay: `${i * 130}ms` }}
            >
              <div
                className={`mono text-[10px] uppercase tracking-[0.16em] ${
                  i === 3 ? "text-[#74b08f]" : "text-white/40"
                }`}
              >
                {n}
              </div>
              <div className="serif mt-1 text-[15px] leading-tight text-white/90">
                {a}
              </div>
              <div className="text-[11px] text-white/60">{b}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // consent
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 360 180" className="w-[380px] max-w-[92%]" fill="none" aria-hidden>
        {/* two person nodes */}
        <circle cx="90" cy="90" r="22" fill="rgba(110,147,182,0.9)" />
        <circle cx="270" cy="90" r="22" fill="rgba(116,176,143,0.9)" />
        {/* dashed half-state, then solid edge revealing */}
        <line
          x1="112"
          y1="90"
          x2="248"
          y2="90"
          stroke="rgba(174,196,220,0.35)"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <line
          x1="112"
          y1="90"
          x2="248"
          y2="90"
          stroke="#8fb0d0"
          strokeWidth="2.5"
          className="ob-draw"
        />
        {/* checkmarks */}
        <g
          className="ob-fade-up"
          style={{ animationDelay: "200ms" } as React.CSSProperties}
        >
          <circle cx="90" cy="50" r="11" fill="#3e7d6a" />
        </g>
        <g
          className="ob-fade-up"
          style={{ animationDelay: "520ms" } as React.CSSProperties}
        >
          <circle cx="270" cy="50" r="11" fill="#3e7d6a" />
        </g>
        <text
          x="90"
          y="138"
          textAnchor="middle"
          className="mono"
          fontSize="9"
          letterSpacing="1.5"
          fill="rgba(200,216,234,0.55)"
        >
          BUYER
        </text>
        <text
          x="270"
          y="138"
          textAnchor="middle"
          className="mono"
          fontSize="9"
          letterSpacing="1.5"
          fill="rgba(200,216,234,0.55)"
        >
          SUPPLIER
        </text>
        {/* check glyphs via foreignObject-free paths */}
        <path
          d="M85 50 l3 3 l6 -7"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ob-fade-up"
          style={{ animationDelay: "260ms" } as React.CSSProperties}
        />
        <path
          d="M265 50 l3 3 l6 -7"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ob-fade-up"
          style={{ animationDelay: "580ms" } as React.CSSProperties}
        />
      </svg>
    </div>
  );
}
