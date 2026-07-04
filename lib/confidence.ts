// Typed surface for the confidence model. The implementation lives in
// confidence.mjs so it can be shared with the standalone seed/reset script.
import type { EdgeKind, ConsentStatus } from "./types";

export interface ConfidenceSignals {
  kind: EdgeKind;
  consent_status: ConsentStatus;
  positives: number;
  refusals: number;
  first_seen_at: string;
  last_confirmed_at?: string | null;
}

export interface ConfidenceTerm {
  label: string;
  detail: string;
  value: number;
}

export interface EdgeConfidenceResult {
  value: number;
  breakdown: ConfidenceTerm[];
  raw: number;
}

import * as impl from "./confidence.mjs";

export const EDGE_BASE: Record<EdgeKind, number> = impl.EDGE_BASE;
export const CONSENT_BONUS: Record<ConsentStatus, number> = impl.CONSENT_BONUS;

export function computeEdgeConfidence(
  signals: ConfidenceSignals,
  nowIso: string
): EdgeConfidenceResult {
  return impl.computeEdgeConfidence(signals, nowIso);
}

export function computePathConfidence(edgeConfidences: number[]): number {
  return impl.computePathConfidence(edgeConfidences);
}
