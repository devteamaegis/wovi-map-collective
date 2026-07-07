"use client";

import { useEffect, useState } from "react";
import { fmtMoney } from "@/lib/reserve/logic";

// The clock the spot buy runs against: elapsed time since the need was logged,
// and the accumulating downtime exposure (cost/hour × hours). Frozen once closed.
export function DowntimeClock({
  createdAt,
  costPerHour,
  closedAt,
  compact = false,
}: {
  createdAt: string;
  costPerHour: number;
  closedAt?: string | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (closedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [closedAt]);

  const start = new Date(createdAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : now;
  const ms = Math.max(0, end - start);
  const hours = ms / 3_600_000;
  const exposure = costPerHour * hours;

  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const elapsed = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;

  if (compact) {
    // A live clock's server vs. client tick will differ by ~1s; suppress the
    // (benign) hydration warning rather than force a 0→real flash.
    return (
      <span suppressHydrationWarning className="mono tabular-nums text-[12px] text-ink-2">
        {elapsed}
        {costPerHour > 0 ? (
          <span className="ml-2 text-danger">{fmtMoney(exposure)}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-[#ecccc8] bg-[#fbeceb] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-[#9b3f37]">
            {closedAt ? "Time to resolution" : "Elapsed — line exposure"}
          </div>
          <div suppressHydrationWarning className="serif mt-1 text-2xl tabular-nums text-ink">{elapsed}</div>
        </div>
        {costPerHour > 0 ? (
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-[0.16em] text-[#9b3f37]">
              Downtime exposure
            </div>
            <div suppressHydrationWarning className="serif mt-1 text-2xl tabular-nums text-[#9b3f37]">
              {fmtMoney(Math.round(exposure))}
            </div>
            <div className="text-[11px] text-ink-3">
              at {fmtMoney(costPerHour)}/hr
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
