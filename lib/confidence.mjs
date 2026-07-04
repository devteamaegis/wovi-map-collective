// Confidence model (Section 6). Pure functions — no DB access — so this module
// is shared by the Next app (via lib/confidence.ts) and the standalone
// seed/reset script. Scores are COMPUTED here, never hand-written.

/** @typedef {'knows'|'sources_from'|'brokered_intro'|'supplies'|'introduced_by'} EdgeKind */
/** @typedef {'none'|'one_sided'|'double_opt_in'} ConsentStatus */

/** Base confidence per edge kind. */
export const EDGE_BASE = {
  knows: 35,
  introduced_by: 40,
  brokered_intro: 55,
  sources_from: 60,
  supplies: 65,
};

/** Consent bonus by consent status. */
export const CONSENT_BONUS = {
  none: 0,
  one_sided: 12,
  double_opt_in: 30,
};

const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n) {
  return Math.round(n);
}

/**
 * Weeks elapsed between an anchor timestamp and `now`.
 * @param {string|null|undefined} lastConfirmed
 * @param {string} firstSeen
 * @param {string} nowIso
 */
function weeksSince(lastConfirmed, firstSeen, nowIso) {
  const anchor = lastConfirmed || firstSeen;
  const then = new Date(anchor).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, (now - then) / MS_PER_WEEK);
}

/**
 * Compute an edge's confidence from its signals, returning the value and a
 * full term-by-term breakdown for the "why this score" UI.
 *
 * @param {{
 *   kind: EdgeKind,
 *   consent_status: ConsentStatus,
 *   positives: number,       // distinct positive outcomes (interested/consented/sourced)
 *   refusals: number,        // refusal outcomes on this edge
 *   first_seen_at: string,
 *   last_confirmed_at?: string|null,
 * }} signals
 * @param {string} nowIso
 */
export function computeEdgeConfidence(signals, nowIso) {
  const base = EDGE_BASE[signals.kind] ?? 35;
  const consentBonus = CONSENT_BONUS[signals.consent_status] ?? 0;

  const corroboration = clamp((signals.positives || 0) * 5, 0, 20);
  const refusalPenalty = (signals.refusals || 0) * 18;

  const weeks = weeksSince(
    signals.last_confirmed_at,
    signals.first_seen_at,
    nowIso
  );
  const recencyDecay = clamp(weeks * 0.4, 0, 25);

  const raw = base + consentBonus + corroboration - refusalPenalty - recencyDecay;
  const value = clamp(round(raw), 0, 100);

  const breakdown = [
    { label: "Base", detail: `${signals.kind}`, value: base },
    {
      label: "Consent bonus",
      detail: signals.consent_status,
      value: consentBonus,
    },
    {
      label: "Corroboration",
      detail: `${signals.positives || 0} positive ×5 (cap +20)`,
      value: corroboration,
    },
    {
      label: "Refusal penalty",
      detail: `${signals.refusals || 0} refusal ×18`,
      value: -refusalPenalty,
    },
    {
      label: "Recency decay",
      detail: `${weeks.toFixed(1)} wk ×0.4 (cap -25)`,
      value: -round(recencyDecay * 10) / 10,
    },
  ];

  return { value, breakdown, raw: round(raw) };
}

/**
 * Path confidence = product of each hop edge's confidence (weakest-link aware).
 * @param {number[]} edgeConfidences confidence (0-100) of each hop edge
 */
export function computePathConfidence(edgeConfidences) {
  if (!edgeConfidences.length) return 0;
  const product = edgeConfidences.reduce((acc, c) => acc * (c / 100), 1);
  return round(product * 100);
}
