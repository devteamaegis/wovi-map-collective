import "server-only";
import { getDb } from "../db";
import type { Person, Edge, Path, Outreach, Consent } from "../types";
import { nowIso } from "./util";
import { tearDownPathsForNode } from "./orgs";

export interface PersonFilter {
  q?: string;
  orgId?: number | "all";
  channel?: "whatsapp" | "wechat" | "phone" | "email" | "all";
}

export interface PersonWithOrg extends Person {
  org_name: string | null;
}

export function listPeople(filter: PersonFilter = {}): PersonWithOrg[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, o.name AS org_name
       FROM people p LEFT JOIN organizations o ON o.id = p.org_id
       ORDER BY p.name COLLATE NOCASE`
    )
    .all() as PersonWithOrg[];
  let people = rows;
  const q = (filter.q || "").toLowerCase().trim();
  if (q) {
    people = people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.title || "").toLowerCase().includes(q) ||
        (p.org_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }
  if (filter.orgId && filter.orgId !== "all") {
    people = people.filter((p) => p.org_id === filter.orgId);
  }
  if (filter.channel && filter.channel !== "all") {
    people = people.filter((p) => {
      const v = (p as any)[filter.channel as string];
      return v != null && v !== "";
    });
  }
  return people;
}

export function getPerson(id: number): PersonWithOrg | null {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT p.*, o.name AS org_name
       FROM people p LEFT JOIN organizations o ON o.id = p.org_id
       WHERE p.id = ?`
    )
    .get(id) as PersonWithOrg | undefined;
  return r ?? null;
}

export interface PersonInput {
  name: string;
  org_id: number | null;
  title?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export function createPerson(input: PersonInput): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO people (name,org_id,title,whatsapp,wechat,phone,email,notes,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.name,
      input.org_id,
      input.title ?? null,
      input.whatsapp ?? null,
      input.wechat ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.notes ?? null,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

export function updatePerson(id: number, input: PersonInput): void {
  const db = getDb();
  db.prepare(
    `UPDATE people SET name=?,org_id=?,title=?,whatsapp=?,wechat=?,phone=?,email=?,notes=? WHERE id=?`
  ).run(
    input.name,
    input.org_id,
    input.title ?? null,
    input.whatsapp ?? null,
    input.wechat ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.notes ?? null,
    id
  );
}

export function deletePerson(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE needs SET requester_person_id = NULL WHERE requester_person_id = ?"
    ).run(id);
    db.prepare(
      "UPDATE paths SET connector_person_id = NULL WHERE connector_person_id = ?"
    ).run(id);
    db.prepare("UPDATE outreach SET person_id = NULL WHERE person_id = ?").run(id);
    // A path that hops through this person is meaningless once they're gone.
    tearDownPathsForNode(db, "person", id);
    db.prepare(
      "DELETE FROM edges WHERE (source_type='person' AND source_id=?) OR (target_type='person' AND target_id=?)"
    ).run(id, id);
    // Consents require a person; remove this person's consent records.
    db.prepare("DELETE FROM consents WHERE person_id = ?").run(id);
    db.prepare("DELETE FROM people WHERE id = ?").run(id);
  });
  tx();
}

export function personEdges(personId: number): Edge[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM edges WHERE (source_type='person' AND source_id=?) OR (target_type='person' AND target_id=?)
       ORDER BY confidence DESC`
    )
    .all(personId, personId) as Edge[];
}

// Paths this person connects (as the connector).
export function personConnectorPaths(personId: number): Path[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM paths WHERE connector_person_id = ? ORDER BY updated_at DESC"
    )
    .all(personId) as Path[];
}

export function personOutreach(personId: number): Outreach[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM outreach WHERE person_id = ? ORDER BY occurred_at DESC"
    )
    .all(personId) as Outreach[];
}

export function personConsents(personId: number): Consent[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM consents WHERE person_id = ? ORDER BY created_at DESC"
    )
    .all(personId) as Consent[];
}
