// FX rates (#11 multi-currency). Quotes in any currency convert to a USD base so
// DOA approval bands and quote comparisons are apples-to-apples. Rates are seeded
// with sane defaults (lib/db.ts) and editable on the integrations page.
import "server-only";
import { getDb } from "../db";
import { nowIso } from "./util";

export interface FxRate {
  currency: string;
  rate_to_usd: number;
  updated_at: string;
}

export function listFxRates(): FxRate[] {
  return getDb().prepare("SELECT * FROM fx_rates ORDER BY currency").all() as FxRate[];
}

export function rateToUsd(currency: string): number {
  if (!currency || currency === "USD") return 1;
  const row = getDb()
    .prepare("SELECT rate_to_usd FROM fx_rates WHERE currency=?")
    .get(currency) as { rate_to_usd: number } | undefined;
  return row?.rate_to_usd ?? 1; // unknown currency → treat 1:1 (flagged in UI)
}

// Convert an amount in `currency` to USD (the DOA base currency).
export function toUsd(amount: number, currency: string): number {
  return amount * rateToUsd(currency);
}

export function isKnownCurrency(currency: string): boolean {
  if (currency === "USD") return true;
  return !!getDb().prepare("SELECT 1 FROM fx_rates WHERE currency=?").get(currency);
}

export function upsertFxRate(currency: string, rate: number): void {
  getDb()
    .prepare(
      "INSERT INTO fx_rates (currency,rate_to_usd,updated_at) VALUES (?,?,?) ON CONFLICT(currency) DO UPDATE SET rate_to_usd=excluded.rate_to_usd, updated_at=excluded.updated_at"
    )
    .run(currency.toUpperCase().trim(), rate, nowIso());
}
