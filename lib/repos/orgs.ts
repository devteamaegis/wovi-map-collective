import "server-only";
import { getDb } from "../db";
import type { Organization, OrgKind, Edge, Person } from "../types";
import { nowIso, parseOrg } from "./util";

export interface OrgFilter {
  q?: string;
  kind?: OrgKind | "all";
  region?: string | "all";
  material?: string;
}

export function listOrgs(filter: OrgFilter = {}): Organization[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM organizations ORDER BY name COLLATE NOCASE")
    .all() as any[];
  let orgs = rows.map(parseOrg);
  const q = (filter.q || "").toLowerCase().trim();
  if (q) {
    orgs = orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.country || "").toLowerCase().includes(q) ||
        o.materials.some((m) => m.toLowerCase().includes(q)) ||
        o.capabilities.some((c) => c.toLowerCase().includes(q))
    );
  }
  if (filter.kind && filter.kind !== "all") {
    orgs = orgs.filter((o) => o.kind === filter.kind);
  }
  if (filter.region && filter.region !== "all") {
    orgs = orgs.filter((o) => o.region === filter.region);
  }
  if (filter.material) {
    const m = filter.material.toLowerCase();
    orgs = orgs.filter(
      (o) =>
        o.materials.some((x) => x.toLowerCase().includes(m)) ||
        o.capabilities.some((x) => x.toLowerCase().includes(m))
    );
  }
  return orgs;
}

export function getOrg(id: number): Organization | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as any;
  return r ? parseOrg(r) : null;
}

export interface OrgInput {
  name: string;
  kind: OrgKind;
  country?: string | null;
  region?: string | null;
  materials: string[];
  capabilities: string[];
  notes?: string | null;
}

export function createOrg(input: OrgInput): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      input.name,
      input.kind,
      input.country ?? null,
      input.region ?? null,
      JSON.stringify(input.materials || []),
      JSON.stringify(input.capabilities || []),
      input.notes ?? null,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

export function updateOrg(id: number, input: OrgInput): void {
  const db = getDb();
  db.prepare(
    `UPDATE organizations SET name=?,kind=?,country=?,region=?,materials=?,capabilities=?,notes=? WHERE id=?`
  ).run(
    input.name,
    input.kind,
    input.country ?? null,
    input.region ?? null,
    JSON.stringify(input.materials || []),
    JSON.stringify(input.capabilities || []),
    input.notes ?? null,
    id
  );
}

export function deleteOrg(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    // Detach references so the delete is clean (no orphan FKs).
    db.prepare("UPDATE people SET org_id = NULL WHERE org_id = ?").run(id);
    db.prepare(
      "UPDATE needs SET requester_org_id = NULL WHERE requester_org_id = ?"
    ).run(id);
    db.prepare("UPDATE paths SET target_org_id = NULL WHERE target_org_id = ?").run(
      id
    );
    // A path that hops through this org is meaningless once it's gone — tear
    // down the whole path (path_hops has no FK, so this won't cascade itself).
    tearDownPathsForNode(db, "org", id);
    db.prepare(
      "DELETE FROM edges WHERE (source_type='org' AND source_id=?) OR (target_type='org' AND target_id=?)"
    ).run(id, id);
    db.prepare("DELETE FROM organizations WHERE id = ?").run(id);
  });
  tx();
}

// Delete every path that includes a hop at the given node, along with its hops,
// and detach the path from its outreach/consents/outcomes. Shared by org/person
// deletion (path_hops.node_id is polymorphic with no foreign key).
export function tearDownPathsForNode(
  db: import("better-sqlite3").Database,
  nodeType: "org" | "person",
  nodeId: number
): void {
  const affected = db
    .prepare(
      "SELECT DISTINCT path_id FROM path_hops WHERE node_type = ? AND node_id = ?"
    )
    .all(nodeType, nodeId) as { path_id: number }[];
  for (const { path_id } of affected) {
    db.prepare("DELETE FROM path_hops WHERE path_id = ?").run(path_id);
    db.prepare("UPDATE outreach SET path_id = NULL WHERE path_id = ?").run(path_id);
    db.prepare("UPDATE consents SET path_id = NULL WHERE path_id = ?").run(path_id);
    db.prepare("UPDATE outcomes SET path_id = NULL WHERE path_id = ?").run(path_id);
    db.prepare("DELETE FROM paths WHERE id = ?").run(path_id);
  }
}

export function orgPeople(orgId: number): Person[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM people WHERE org_id = ? ORDER BY name COLLATE NOCASE")
    .all(orgId) as Person[];
}

export function distinctRegions(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT DISTINCT region FROM organizations WHERE region IS NOT NULL ORDER BY region"
    )
    .all() as { region: string }[];
  return rows.map((r) => r.region);
}

export function distinctMaterials(): string[] {
  const orgs = listOrgs();
  const set = new Set<string>();
  for (const o of orgs) {
    o.materials.forEach((m) => set.add(m));
    o.capabilities.forEach((c) => set.add(c));
  }
  return Array.from(set).sort();
}

// All edges touching this org node (either endpoint).
export function orgEdges(orgId: number): Edge[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM edges WHERE (source_type='org' AND source_id=?) OR (target_type='org' AND target_id=?)
       ORDER BY confidence DESC`
    )
    .all(orgId, orgId) as Edge[];
}
