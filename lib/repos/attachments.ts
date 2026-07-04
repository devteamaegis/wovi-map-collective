import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../db";
import { nowIso } from "./util";

// Local disk store by default (WOVI_UPLOAD_DIR, else ./uploads). The storage
// column records which backend holds the bytes so an S3/Blob backend can be
// added later without touching callers.
const UPLOAD_DIR = process.env.WOVI_UPLOAD_DIR || path.join(process.cwd(), "uploads");

export type AttachmentKind =
  | "mill_cert"
  | "quote"
  | "commercial_invoice"
  | "packing_list"
  | "other";

export interface Attachment {
  id: number;
  spot_buy_id: number | null;
  kind: AttachmentKind;
  filename: string;
  mime: string | null;
  size: number;
  storage: string;
  storage_key: string;
  uploaded_by_user_id: number | null;
  created_at: string;
}

export const ATTACHMENT_LABEL: Record<AttachmentKind, string> = {
  mill_cert: "Mill certificate",
  quote: "Quote document",
  commercial_invoice: "Commercial invoice",
  packing_list: "Packing list",
  other: "Document",
};

export function listAttachments(spotBuyId: number): Attachment[] {
  return getDb()
    .prepare("SELECT * FROM attachments WHERE spot_buy_id=? ORDER BY id DESC")
    .all(spotBuyId) as Attachment[];
}

export function getAttachment(id: number): Attachment | null {
  return (getDb().prepare("SELECT * FROM attachments WHERE id=?").get(id) as Attachment | undefined) ?? null;
}

export function saveAttachment(input: {
  spot_buy_id: number | null;
  kind: AttachmentKind;
  filename: string;
  mime: string | null;
  bytes: Buffer;
  uploaded_by_user_id?: number | null;
}): number {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeName = input.filename.replace(/[^\w.\- ]/g, "_").slice(0, 120) || "file";
  const key = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safeName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, key), input.bytes);
  const info = getDb()
    .prepare(
      `INSERT INTO attachments (spot_buy_id,kind,filename,mime,size,storage,storage_key,uploaded_by_user_id,created_at)
       VALUES (?,?,?,?,?,'local',?,?,?)`
    )
    .run(
      input.spot_buy_id,
      input.kind,
      input.filename.slice(0, 200),
      input.mime,
      input.bytes.length,
      key,
      input.uploaded_by_user_id ?? null,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

// Resolve a storage key strictly inside UPLOAD_DIR — defense-in-depth against a
// traversal payload ever reaching the storage_key column (e.g. a future writer
// or a direct DB insert).
function safeLocalPath(storageKey: string): string | null {
  const base = path.resolve(UPLOAD_DIR);
  const p = path.resolve(base, storageKey);
  if (p !== base && !p.startsWith(base + path.sep)) return null;
  return p;
}

export function readAttachmentBytes(a: Attachment): Buffer | null {
  const p = safeLocalPath(a.storage_key);
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

export function deleteAttachment(id: number): void {
  const a = getAttachment(id);
  if (a) {
    const p = safeLocalPath(a.storage_key);
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
    getDb().prepare("DELETE FROM attachments WHERE id=?").run(id);
  }
}
