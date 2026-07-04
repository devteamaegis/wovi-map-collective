import "server-only";
import { getDb } from "../db";
import type { Organization, Person, NodeType } from "../types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseOrg(r: any): Organization {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    country: r.country,
    region: r.region,
    materials: safeArray(r.materials),
    capabilities: safeArray(r.capabilities),
    notes: r.notes,
    created_at: r.created_at,
  };
}

export function safeArray(s: unknown): string[] {
  if (!s || typeof s !== "string") return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export interface NodeLabel {
  type: NodeType;
  id: number;
  label: string;
  sublabel: string | null;
  kind: string | null; // org kind for orgs; null for people
}

// Resolve a graph node (org or person) to a display label.
export function resolveNode(type: NodeType, id: number): NodeLabel | null {
  const db = getDb();
  if (type === "org") {
    const o = db
      .prepare("SELECT id,name,kind,region FROM organizations WHERE id = ?")
      .get(id) as any;
    if (!o) return null;
    return {
      type,
      id,
      label: o.name,
      sublabel: o.region,
      kind: o.kind,
    };
  }
  const p = db
    .prepare(
      `SELECT p.id, p.name, p.title, o.name AS org_name
       FROM people p LEFT JOIN organizations o ON o.id = p.org_id
       WHERE p.id = ?`
    )
    .get(id) as any;
  if (!p) return null;
  return {
    type,
    id,
    label: p.name,
    sublabel: p.title ? `${p.title}${p.org_name ? " · " + p.org_name : ""}` : p.org_name,
    kind: null,
  };
}

export function resolveNodeMany(
  refs: { type: NodeType; id: number }[]
): NodeLabel[] {
  return refs.map((r) => resolveNode(r.type, r.id)).filter(Boolean) as NodeLabel[];
}
