// Tamper-evident audit hash-chain (#5). Each event's hash covers its own fields
// plus the previous event's hash, so any insertion, deletion, or edit anywhere in
// the ledger breaks every subsequent hash. Kept server-only (uses node:crypto).
import crypto from "node:crypto";

export interface AuditHashFields {
  spot_buy_id: number;
  actor: string;
  actor_person_id: number | null;
  stage: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

// Deterministic serialization → sha256, folded with the prior hash.
export function auditHash(prevHash: string | null, f: AuditHashFields): string {
  const canonical = [
    prevHash ?? "",
    f.spot_buy_id,
    f.actor,
    f.actor_person_id ?? "",
    f.stage ?? "",
    f.action,
    f.detail ?? "",
    f.created_at,
  ].join("␟"); // unit-separator delimiter avoids field-collision
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
