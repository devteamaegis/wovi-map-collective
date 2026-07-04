// Quote parsing (#3): turn a pasted/emailed supplier reply into the structured
// fields the comparison view needs. The heuristic parser below is pure and
// deterministic (no keys); an optional LLM pass (lib/repos/quote-ai.ts) refines
// it when an API key is configured. This mirrors "AI drafts, human confirms" —
// parsed values land in an editable form, never auto-committed.

export interface ParsedQuote {
  unit_price: number | null;
  quantity: number | null;
  lead_time_days: number | null;
  freight_cost: number | null;
  moq: number | null;
  incoterm: string | null;
  currency: string;
  confidence: number; // 0..1 heuristic confidence
  fields_found: string[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "₩": "KRW",
};
const CURRENCY_CODES = ["USD", "EUR", "GBP", "JPY", "CNY", "RMB", "TRY", "NOK", "CAD", "MXN", "INR", "KRW"];
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const UOM = "kgs?|lbs?|mt|tonnes?|tons?|t|pcs?|ea|units?|pieces?|each";

// Split on newlines/semicolons and field-separator commas only — a comma
// immediately followed by a digit is a thousands separator, not a field break.
function segmentize(text: string): string[] {
  return text.split(/\n+|;+|,(?!\d)/);
}

// Parse a number that may use US (1,234.56) or EU (1.234,56) grouping/decimals.
function parseAmount(raw: string): number {
  let s = raw.replace(/[£$€¥₹₩\s]/g, "");
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // The rightmost separator is the decimal point.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const parts = s.split(",");
    const after = parts[parts.length - 1];
    // Multiple commas, or a trailing group of exactly 3 digits → thousands.
    if (parts.length > 2 || after.length === 3) s = s.replace(/,/g, "");
    else s = s.replace(",", "."); // e.g. "3,40" → 3.40 (EU decimal)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// Keyword match with a left word-boundary so "each" doesn't fire inside "reach"
// while "/kg" still matches "1.12/kg" (preceded by a digit, not a letter).
function kwMatch(hay: string, kw: string): number {
  const re = new RegExp("(?:^|[^a-z])" + escapeRe(kw), "i");
  const m = re.exec(hay);
  return m ? m.index : -1;
}

const NUM_RE = /[£$€¥₹₩]?\s?\d[\d.,]*/;

// Find the amount attached to any of `keywords`, within the keyword's own
// segment, preferring a number that appears after the keyword.
function amountNear(text: string, keywords: string[]): number | null {
  for (const seg of segmentize(text)) {
    const low = seg.toLowerCase();
    let hitAt = -1;
    let hitLen = 0;
    for (const k of keywords) {
      const at = kwMatch(low, k);
      if (at >= 0 && (hitAt === -1 || at < hitAt)) { hitAt = at; hitLen = k.length; }
    }
    if (hitAt === -1) continue;
    const after = seg.slice(hitAt + 1 + hitLen);
    const m = after.match(NUM_RE) || seg.match(NUM_RE);
    if (m) {
      const val = parseAmount(m[0]);
      if (Number.isFinite(val) && val > 0) return val;
    }
  }
  return null;
}

// Currency actually quoted = the code/symbol that appears EARLIEST in the text.
function detectCurrency(text: string): string {
  const upper = text.toUpperCase();
  let best = { pos: Infinity, cur: "USD" };
  for (const code of CURRENCY_CODES) {
    const m = new RegExp("\\b" + code + "\\b").exec(upper);
    if (m && m.index < best.pos) best = { pos: m.index, cur: code === "RMB" ? "CNY" : code };
  }
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    const i = text.indexOf(sym);
    if (i >= 0 && i < best.pos) best = { pos: i, cur: code };
  }
  return best.cur;
}

// Lead time in days. Prefer a "lead"-labelled segment; ignore validity windows
// ("valid for 30 days") so they don't poison the promised lead time.
function detectLeadDays(text: string): number | null {
  const segs = segmentize(text).filter((s) => !/valid|expir/i.test(s));
  const ordered = [...segs.filter((s) => /lead/i.test(s)), ...segs];
  for (const s of ordered) {
    const dy = s.match(/(\d+(?:\.\d+)?)\s*(days?|d)\b/i);
    if (dy) return Math.round(Number(dy[1]));
    const wk = s.match(/(\d+(?:\.\d+)?)\s*(weeks?|wks?)\b/i);
    if (wk) return Math.round(Number(wk[1]) * 7);
  }
  return null;
}

// Bare "60,000 kg" quantity when there's no "quantity"/"qty" label. Requires a
// UoM immediately after the number so it won't grab a "/kg" unit price.
function detectBareQuantity(text: string): number | null {
  const re = new RegExp("(\\d[\\d.,]*)\\s+(" + UOM + ")\\b", "i");
  const m = text.match(re);
  if (m) {
    const v = parseAmount(m[1]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

export function heuristicParseQuote(text: string): ParsedQuote {
  const found: string[] = [];
  const currency = detectCurrency(text);

  const unit_price = amountNear(text, [
    "unit price", "price/unit", "price per", "per unit", "unit cost", "each",
    "/pc", "/kg", "/lb", "/mt", "/ton", "/unit", "/ea", "per kg", "per lb",
    "per ton", "per tonne", "per mt",
  ]);
  if (unit_price != null) found.push("unit_price");

  let quantity = amountNear(text, ["quantity", "qty", "order qty", "volume"]);
  if (quantity == null) quantity = detectBareQuantity(text);
  if (quantity != null) found.push("quantity");

  const lead_time_days = detectLeadDays(text);
  if (lead_time_days != null) found.push("lead_time_days");

  const freight_cost = amountNear(text, ["freight", "shipping", "expedite", "air freight", "logistics", "delivery cost"]);
  if (freight_cost != null) found.push("freight_cost");

  const moq = amountNear(text, ["moq", "minimum order", "min order", "minimum quantity"]);
  if (moq != null) found.push("moq");

  const incoterm = INCOTERMS.find((t) => new RegExp(`\\b${t}\\b`).test(text.toUpperCase())) ?? null;
  if (incoterm) found.push("incoterm");

  const keyFields = ["unit_price", "quantity", "lead_time_days", "freight_cost"];
  const confidence = keyFields.filter((k) => found.includes(k)).length / keyFields.length;

  return { unit_price, quantity, lead_time_days, freight_cost, moq, incoterm, currency, confidence, fields_found: found };
}
