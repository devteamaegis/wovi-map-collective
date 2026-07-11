import "server-only";
import { getDb } from "../db";
import type { Need, NeedKind, NeedStatus, Priority, Path } from "../types";
import { nowIso } from "./util";

export interface NeedFilter {
  q?: string;
  status?: NeedStatus | "all";
  kind?: NeedKind | "all";
  priority?: Priority | "all";
  sort?: "recent" | "priority" | "status";
}

export interface NeedWithMeta extends Need {
  requester_org_name: string | null;
  requester_person_name: string | null;
  path_count: number;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };
const STATUS_RANK: Record<NeedStatus, number> = {
  brokering: 0,
  open: 1,
  matched: 2,
  closed: 3,
};

export function listNeeds(filter: NeedFilter = {}): NeedWithMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*, o.name AS requester_org_name, p.name AS requester_person_name,
              (SELECT COUNT(*) FROM paths WHERE need_id = n.id AND status NOT IN ('dead','declined')) AS path_count
       FROM needs n
       LEFT JOIN organizations o ON o.id = n.requester_org_id
       LEFT JOIN people p ON p.id = n.requester_person_id`
    )
    .all() as NeedWithMeta[];

  let needs = rows;
  const q = (filter.q || "").toLowerCase().trim();
  if (q) {
    needs = needs.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.description || "").toLowerCase().includes(q) ||
        (n.material_tag || "").toLowerCase().includes(q) ||
        (n.requester_org_name || "").toLowerCase().includes(q)
    );
  }
  if (filter.status && filter.status !== "all")
    needs = needs.filter((n) => n.status === filter.status);
  if (filter.kind && filter.kind !== "all")
    needs = needs.filter((n) => n.kind === filter.kind);
  if (filter.priority && filter.priority !== "all")
    needs = needs.filter((n) => n.priority === filter.priority);

  const sort = filter.sort || "recent";
  needs.sort((a, b) => {
    if (sort === "priority")
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.created_at.localeCompare(a.created_at)
      );
    if (sort === "status")
      return (
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.created_at.localeCompare(a.created_at)
      );
    return b.created_at.localeCompare(a.created_at);
  });
  return needs;
}

export function getNeed(id: number): NeedWithMeta | null {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT n.*, o.name AS requester_org_name, p.name AS requester_person_name,
              (SELECT COUNT(*) FROM paths WHERE need_id = n.id AND status NOT IN ('dead','declined')) AS path_count
       FROM needs n
       LEFT JOIN organizations o ON o.id = n.requester_org_id
       LEFT JOIN people p ON p.id = n.requester_person_id
       WHERE n.id = ?`
    )
    .get(id) as NeedWithMeta | undefined;
  return r ?? null;
}

export interface NeedInput {
  title: string;
  kind: NeedKind;
  description?: string | null;
  material_tag?: string | null;
  target_region?: string | null;
  requester_org_id: number | null;
  requester_person_id: number | null;
  priority: Priority;
}

export function createNeed(input: NeedInput): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO needs (title,kind,description,material_tag,target_region,requester_org_id,requester_person_id,status,priority,created_at,closed_at)
       VALUES (?,?,?,?,?,?,?,'open',?,?,NULL)`
    )
    .run(
      input.title,
      input.kind,
      input.description ?? null,
      input.material_tag ?? null,
      input.target_region ?? null,
      input.requester_org_id,
      input.requester_person_id,
      input.priority,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

export function setNeedStatus(id: number, status: NeedStatus): void {
  const db = getDb();
  const closedAt = status === "closed" || status === "matched" ? nowIso() : null;
  if (status === "closed" || status === "matched") {
    db.prepare("UPDATE needs SET status = ?, closed_at = ? WHERE id = ?").run(
      status,
      closedAt,
      id
    );
  } else {
    db.prepare("UPDATE needs SET status = ?, closed_at = NULL WHERE id = ?").run(
      status,
      id
    );
  }
}

export function needPaths(needId: number): Path[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM paths WHERE need_id = ? ORDER BY confidence DESC")
    .all(needId) as Path[];
}

export function deleteNeed(id: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const paths = db
      .prepare("SELECT id FROM paths WHERE need_id = ?")
      .all(id) as { id: number }[];
    for (const p of paths) {
      db.prepare("DELETE FROM path_hops WHERE path_id = ?").run(p.id);
      db.prepare("UPDATE outreach SET path_id = NULL WHERE path_id = ?").run(p.id);
      db.prepare("UPDATE consents SET path_id = NULL WHERE path_id = ?").run(p.id);
      db.prepare("UPDATE outcomes SET path_id = NULL WHERE path_id = ?").run(p.id);
      db.prepare("DELETE FROM paths WHERE id = ?").run(p.id);
    }
    db.prepare("DELETE FROM needs WHERE id = ?").run(id);
  });
  tx();
}
