// Pure Reserve logic — money math, the downtime clock, best-value quote ranking,
// DOA threshold matching, and the deterministic local "AI drafting" that the spec
// calls for (RFQ bodies, requisition field checks, PO numbers, customs inference).
// No external services — every "draft" is generated from the record itself.
import type {
  SpotBuy,
  Quote,
  Metal,
  SpotBuyTrigger,
  Urgency,
  DoaRule,
} from "./types";

export function fmtMoney(n: number, currency = "USD"): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "USD" ? "$" : currency + " ";
  return `${sign}${symbol}${s}`;
}

/** Landed total of a quote: unit price × quantity + freight. */
export function landedTotal(q: Pick<Quote, "unit_price" | "quantity" | "freight_cost">): number {
  return q.unit_price * q.quantity + q.freight_cost;
}

export function requisitionTotal(
  unitPrice: number,
  quantity: number,
  freight: number
): number {
  return unitPrice * quantity + freight;
}

const MS_PER_HOUR = 1000 * 60 * 60;

export function hoursSince(iso: string | null | undefined, nowIso: string): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, (now - then) / MS_PER_HOUR);
}

/**
 * Downtime exposure = downtime cost/hour × hours the buy has been open. This is
 * the clock the spec runs against ("$2.3M/hour" for an idle line). Frozen once
 * closed.
 */
export function downtimeExposure(sb: SpotBuy, nowIso: string): number {
  const end = sb.closed_at ?? nowIso;
  return sb.downtime_cost_per_hour * hoursSince(sb.created_at, end);
}

export interface RankedQuote extends Quote {
  landed: number;
  score: number;
  recommended: boolean;
  isCheapest: boolean;
  isFastest: boolean;
}

/**
 * Best-value ranking: landed cost with a mild lead-time penalty (speed matters
 * under line-down pressure). Lowest score wins.
 */
export function rankQuotes(quotes: Quote[]): RankedQuote[] {
  if (!quotes.length) return [];
  const withLanded = quotes.map((q) => ({
    ...q,
    landed: landedTotal(q),
    score: landedTotal(q) * (1 + 0.02 * q.lead_time_days),
    recommended: false,
    isCheapest: false,
    isFastest: false,
  }));
  const minLanded = Math.min(...withLanded.map((q) => q.landed));
  const minLead = Math.min(...withLanded.map((q) => q.lead_time_days));
  const best = withLanded.reduce((a, b) => (b.score < a.score ? b : a));
  for (const q of withLanded) {
    q.isCheapest = q.landed === minLanded;
    q.isFastest = q.lead_time_days === minLead;
    q.recommended = q.id === best.id;
  }
  return withLanded.sort((a, b) => a.score - b.score);
}

/** Match a requisition amount to the DOA rule whose threshold band contains it. */
export function matchDoaRule(rules: DoaRule[], amount: number): DoaRule | null {
  const hits = rules
    .filter(
      (r) => amount >= r.min_amount && (r.max_amount == null || amount <= r.max_amount)
    )
    .sort((a, b) => b.min_amount - a.min_amount); // highest band that still fits
  return hits[0] ?? null;
}

export const TRIGGER_LABEL: Record<SpotBuyTrigger, string> = {
  mrp_exception: "MRP exception",
  quality_rejection: "Quality rejection",
  line_down: "Line down",
  shortage: "Shortage",
  volume_change: "Volume change",
  force_majeure: "Force majeure",
};

export const URGENCY_RANK: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
};

// ---- Deterministic "AI drafting" -----------------------------------------

/** Draft a tailored RFQ body from the spot buy (labelled AI-drafted in the UI). */
export function draftRfqBody(
  sb: SpotBuy,
  buyerOrgName: string | null,
  supplierNames: string[]
): string {
  const need = sb.required_by
    ? `required on site by ${new Date(sb.required_by).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`
    : "required as soon as possible";
  const qty = `${sb.quantity}${sb.uom ? " " + sb.uom : ""}`;
  const cb = sb.cross_border
    ? `\n\nThis is a cross-border shipment${
        sb.metal !== "none"
          ? ` of ${sb.metal}; please include a mill test certificate and country-of-${
              sb.metal === "steel" ? "melt-and-pour" : "smelt-and-cast"
            } declaration with your quote (Section 232).`
          : "."
      }`
    : "";
  return `Subject: Urgent RFQ — ${sb.material_desc || sb.title} (${sb.ref})

Hello,

${buyerOrgName || "Our team"} has an urgent requirement and is requesting a quote from our approved supplier base${
    supplierNames.length ? ` (${supplierNames.slice(0, 4).join(", ")}${supplierNames.length > 4 ? ", …" : ""})` : ""
  }.

  • Material: ${sb.material_desc || sb.title}${sb.material_number ? ` (${sb.material_number})` : ""}
  • Quantity: ${qty}
  • Need-by: ${need}
  • Ship-to: ${sb.plant || sb.ship_to_country || "our plant"}

Please reply with your unit price, lead time, MOQ, and expedited freight cost. We are moving quickly against a potential line stoppage and will award on best landed value.${cb}

Thank you,
Reserve — on behalf of ${buyerOrgName || "the buyer"}`;
}

const REQUIRED_REQ_FIELDS: { key: string; label: string }[] = [
  { key: "material_number", label: "Material number" },
  { key: "quantity", label: "Quantity" },
  { key: "cost_center", label: "Cost center" },
  { key: "need_by", label: "Need-by date" },
  { key: "supplier_org_id", label: "Supplier" },
];

/** Flag missing requisition fields before submission (kills the rework loop). */
export function detectMissingFields(req: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_REQ_FIELDS) {
    const v = req[f.key];
    if (v === null || v === undefined || v === "" || v === 0) missing.push(f.label);
  }
  return missing;
}

/** Deterministic PO number from the spot-buy ref + id. */
export function poNumberFor(sb: SpotBuy): string {
  const yr = new Date(sb.created_at).getFullYear();
  return `PO-${yr}-${String(4500 + sb.id).padStart(4, "0")}`;
}

/** Infer an HS code bucket from the metal / material (illustrative). */
export function hsCodeFor(metal: Metal, materialDesc: string | null): string {
  if (metal === "steel") return "7208.39"; // flat-rolled steel
  if (metal === "aluminum") return "7606.12"; // aluminum plate/sheet
  const d = (materialDesc || "").toLowerCase();
  if (d.includes("copper")) return "7409.11";
  if (d.includes("connector") || d.includes("electronic")) return "8536.69";
  if (d.includes("bearing")) return "8482.10";
  return "8479.90";
}

export function meltSmeltField(metal: Metal): string {
  if (metal === "steel") return "Country of melt & pour";
  if (metal === "aluminum") return "Country of smelt & cast";
  return "Country of origin";
}

// ---- 3-way match (#13) -----------------------------------------------------
export type MatchStatus =
  | "pending"
  | "matched"
  | "qty_variance"
  | "price_variance"
  | "both_variance";

/**
 * Compare PO ↔ goods receipt ↔ supplier invoice within a tolerance. Quantity
 * variance = received vs ordered; price variance = invoiced vs PO amount.
 */
export function threeWayMatch(args: {
  qtyOrdered: number;
  qtyReceived: number;
  poAmount: number;
  invoiceAmount: number | null;
  tolerancePct?: number;
}): MatchStatus {
  const tol = args.tolerancePct ?? 0.02;
  const qtyOff =
    args.qtyOrdered > 0 &&
    Math.abs(args.qtyReceived - args.qtyOrdered) / args.qtyOrdered > tol;
  const priceOff =
    args.invoiceAmount != null &&
    args.poAmount > 0 &&
    Math.abs(args.invoiceAmount - args.poAmount) / args.poAmount > tol;
  if (qtyOff && priceOff) return "both_variance";
  if (qtyOff) return "qty_variance";
  if (priceOff) return "price_variance";
  return "matched";
}

export const MATCH_LABEL: Record<MatchStatus, string> = {
  pending: "Pending",
  matched: "3-way matched",
  qty_variance: "Quantity variance",
  price_variance: "Price variance",
  both_variance: "Qty + price variance",
};
