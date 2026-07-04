import "server-only";
import { getDb } from "../db";

export interface SearchResult {
  type: "org" | "person" | "need";
  id: number;
  label: string;
  sublabel: string;
  href: string;
}

// Global search across orgs, people, and needs for the top-bar.
export function globalSearch(query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const db = getDb();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const orgs = db
    .prepare(
      `SELECT id, name, kind, region FROM organizations
       WHERE lower(name) LIKE ? OR lower(country) LIKE ? OR lower(materials) LIKE ? OR lower(capabilities) LIKE ?
       LIMIT ?`
    )
    .all(like, like, like, like, limit) as any[];
  for (const o of orgs) {
    results.push({
      type: "org",
      id: o.id,
      label: o.name,
      sublabel: `${o.kind}${o.region ? " · " + o.region : ""}`,
      href: `/directory/org/${o.id}`,
    });
  }

  const people = db
    .prepare(
      `SELECT p.id, p.name, p.title, o.name AS org_name FROM people p
       LEFT JOIN organizations o ON o.id = p.org_id
       WHERE lower(p.name) LIKE ? OR lower(p.title) LIKE ? OR lower(p.email) LIKE ?
       LIMIT ?`
    )
    .all(like, like, like, limit) as any[];
  for (const p of people) {
    results.push({
      type: "person",
      id: p.id,
      label: p.name,
      sublabel: [p.title, p.org_name].filter(Boolean).join(" · ") || "Person",
      href: `/directory/person/${p.id}`,
    });
  }

  const needs = db
    .prepare(
      `SELECT id, title, kind, status FROM needs
       WHERE lower(title) LIKE ? OR lower(description) LIKE ? OR lower(material_tag) LIKE ?
       LIMIT ?`
    )
    .all(like, like, like, limit) as any[];
  for (const n of needs) {
    results.push({
      type: "need",
      id: n.id,
      label: n.title,
      sublabel: `Need · ${n.kind} · ${n.status}`,
      href: `/needs/${n.id}`,
    });
  }

  return results;
}
