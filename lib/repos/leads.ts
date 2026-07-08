import "server-only";
import { getDb } from "@/lib/db";

export interface Lead {
  id: number;
  name: string | null;
  email: string;
  company: string | null;
  source: string | null;
  created_at: string;
}

/** Store a captured lead from the demo paywall. */
export function insertLead(input: {
  name?: string | null;
  email: string;
  company?: string | null;
  source?: string | null;
}): number {
  const db = getDb();
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO leads (name,email,company,source,created_at) VALUES (?,?,?,?,?)"
    )
    .run(
      input.name ?? null,
      input.email,
      input.company ?? null,
      input.source ?? null,
      now
    );
  return Number(info.lastInsertRowid);
}

export function listLeads(): Lead[] {
  const db = getDb();
  return db
    .prepare("SELECT id,name,email,company,source,created_at FROM leads ORDER BY id DESC")
    .all() as Lead[];
}
