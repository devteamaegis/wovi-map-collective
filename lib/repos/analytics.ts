import "server-only";
import { getDb } from "../db";
import { hoursSince } from "../reserve/logic";

// Cycle-time analytics (#8): reconstruct per-stage durations from the audit
// ledger and measure them against the APQC world-class benchmark (a spot buy
// resolved in ≤5 hours). All timings come from real audit timestamps.

export const APQC_BENCHMARK_HOURS = 5;

// Milestone audit actions that mark stage boundaries.
const MILESTONES: Record<string, string[]> = {
  created: ["Spot buy logged", "Trigger ingested via API"],
  rfq_sent: ["RFQ broadcast approved"],
  first_quote: ["Quote parsed"],
  selected: ["Supplier selected"],
  submitted: ["Requisition submitted"],
  approved: ["Approval granted"],
  po_released: ["PO released"],
  closed: ["Spot buy closed"],
};

const STAGES: { key: string; label: string; from: string; to: string }[] = [
  { key: "triage", label: "Triage → RFQ", from: "created", to: "rfq_sent" },
  { key: "sourcing", label: "RFQ → first quote", from: "rfq_sent", to: "first_quote" },
  { key: "quoting", label: "Quote → select", from: "first_quote", to: "selected" },
  { key: "requisition", label: "Select → submit", from: "selected", to: "submitted" },
  { key: "approval", label: "Submit → approve", from: "submitted", to: "approved" },
  { key: "po", label: "Approve → PO out", from: "approved", to: "po_released" },
  { key: "receiving", label: "PO → closed", from: "po_released", to: "closed" },
];

export interface StageStat {
  key: string;
  label: string;
  avgHours: number | null;
  samples: number;
}

export interface ResolutionRow {
  id: number;
  ref: string;
  title: string;
  hours: number;
  underBenchmark: boolean;
  downtimeAvoided: number; // exposure that would have accrued over an industry-typical delay
}

export interface CycleAnalytics {
  closedCount: number;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
  pctUnderBenchmark: number | null;
  totalDowntimeAvoided: number;
  stages: StageStat[];
  resolutions: ResolutionRow[];
}

function firstTs(events: { action: string; created_at: string }[], keys: string[]): string | null {
  for (const e of events) if (keys.includes(e.action)) return e.created_at;
  return null;
}

// Industry-typical manual spot-buy takes days; we credit exposure avoided vs a
// conservative baseline delay (configurable), capped at the actual per-hour cost.
const BASELINE_DELAY_HOURS = Number(process.env.WOVI_BASELINE_DELAY_HOURS ?? 72);

export function cycleAnalytics(): CycleAnalytics {
  const db = getDb();
  const closed = db
    .prepare("SELECT id,ref,title,created_at,closed_at,downtime_cost_per_hour FROM spot_buys WHERE status='closed' AND closed_at IS NOT NULL ORDER BY closed_at DESC")
    .all() as { id: number; ref: string; title: string; created_at: string; closed_at: string; downtime_cost_per_hour: number }[];

  const stageAcc: Record<string, number[]> = {};
  for (const s of STAGES) stageAcc[s.key] = [];

  const resolutions: ResolutionRow[] = [];
  let totalAvoided = 0;

  for (const sb of closed) {
    const events = db
      .prepare("SELECT action, created_at FROM audit_events WHERE spot_buy_id=? ORDER BY created_at, id")
      .all(sb.id) as { action: string; created_at: string }[];
    const ts: Record<string, string | null> = {};
    for (const [k, actions] of Object.entries(MILESTONES)) ts[k] = firstTs(events, actions);

    for (const s of STAGES) {
      const a = ts[s.from];
      const b = ts[s.to];
      if (a && b) {
        const h = hoursSince(a, b);
        if (h >= 0) stageAcc[s.key].push(h);
      }
    }

    const hours = hoursSince(sb.created_at, sb.closed_at);
    // Exposure avoided vs the baseline manual delay (only meaningful when a line
    // is actually down, i.e. a per-hour cost exists).
    const avoided = sb.downtime_cost_per_hour * Math.max(0, BASELINE_DELAY_HOURS - hours);
    totalAvoided += avoided;
    resolutions.push({
      id: sb.id,
      ref: sb.ref,
      title: sb.title,
      hours,
      underBenchmark: hours <= APQC_BENCHMARK_HOURS,
      downtimeAvoided: avoided,
    });
  }

  const resHours = resolutions.map((r) => r.hours).sort((a, b) => a - b);
  const avg = resHours.length ? resHours.reduce((s, x) => s + x, 0) / resHours.length : null;
  const median = resHours.length ? resHours[Math.floor((resHours.length - 1) / 2)] : null;
  const under = resolutions.filter((r) => r.underBenchmark).length;

  const stages: StageStat[] = STAGES.map((s) => {
    const arr = stageAcc[s.key];
    return {
      key: s.key,
      label: s.label,
      avgHours: arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null,
      samples: arr.length,
    };
  });

  return {
    closedCount: closed.length,
    avgResolutionHours: avg,
    medianResolutionHours: median,
    pctUnderBenchmark: resolutions.length ? (under / resolutions.length) * 100 : null,
    totalDowntimeAvoided: totalAvoided,
    stages,
    resolutions,
  };
}
