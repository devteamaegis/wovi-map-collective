// Quote parsing entry point (#3). Uses an LLM when WOVI_AI_KEY is configured,
// otherwise the deterministic heuristic parser (lib/reserve/parse.ts). Always
// falls back to the heuristic on any error, and never auto-commits — parsed
// values land in an editable form for a human to confirm.
import "server-only";
import { heuristicParseQuote, type ParsedQuote } from "../reserve/parse";

export interface ParseResult extends ParsedQuote {
  source: "ai" | "heuristic";
}

// Parse a raw supplier quote. Uses an LLM when WOVI_AI_KEY is set (Anthropic by
// default; OpenAI-compatible when WOVI_AI_BASE_URL points elsewhere), otherwise
// the deterministic heuristic parser. Always falls back to heuristic on error.
export async function parseQuoteText(text: string): Promise<ParseResult> {
  const heuristic = heuristicParseQuote(text);
  const key = process.env.WOVI_AI_KEY;
  if (!key) return { ...heuristic, source: "heuristic" };
  try {
    const ai = await llmParse(text, key);
    if (ai) {
      // Prefer AI values, fill gaps from heuristic.
      return {
        unit_price: ai.unit_price ?? heuristic.unit_price,
        quantity: ai.quantity ?? heuristic.quantity,
        lead_time_days: ai.lead_time_days ?? heuristic.lead_time_days,
        freight_cost: ai.freight_cost ?? heuristic.freight_cost,
        moq: ai.moq ?? heuristic.moq,
        incoterm: ai.incoterm ?? heuristic.incoterm,
        currency: ai.currency ?? heuristic.currency,
        confidence: Math.max(heuristic.confidence, 0.8),
        fields_found: heuristic.fields_found,
        source: "ai",
      };
    }
  } catch {
    /* fall through to heuristic */
  }
  return { ...heuristic, source: "heuristic" };
}

async function llmParse(text: string, key: string): Promise<Partial<ParsedQuote> | null> {
  const base = process.env.WOVI_AI_BASE_URL || "https://api.anthropic.com";
  const model = process.env.WOVI_AI_MODEL || "claude-sonnet-5";
  const prompt = `Extract these fields from the supplier quote as strict JSON with keys unit_price, quantity, lead_time_days, freight_cost, moq (numbers or null), incoterm (string or null), currency (ISO code). Reply with JSON only.\n\nQUOTE:\n${text.slice(0, 4000)}`;

  // Anthropic Messages API shape (default). For OpenAI-compatible gateways set
  // WOVI_AI_BASE_URL to that host; the request below still works for Anthropic.
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const content: string = data?.content?.[0]?.text ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  return {
    unit_price: numOrNull(parsed.unit_price),
    quantity: numOrNull(parsed.quantity),
    lead_time_days: numOrNull(parsed.lead_time_days),
    freight_cost: numOrNull(parsed.freight_cost),
    moq: numOrNull(parsed.moq),
    incoterm: parsed.incoterm ?? null,
    currency: typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : "USD",
  };
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
