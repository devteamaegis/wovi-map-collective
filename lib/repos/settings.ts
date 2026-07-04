import "server-only";
import crypto from "node:crypto";
import { getDb } from "../db";
import { nowIso } from "./util";

// ------------------------------------------------------------------ settings

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

// ------------------------------------------------------------------ API token

export function getApiToken(): string | null {
  return getSetting("api_token");
}

export function rotateApiToken(): string {
  const token = "wovi_" + crypto.randomBytes(24).toString("hex");
  setSetting("api_token", token);
  return token;
}

// Constant-time check of "Authorization: Bearer <token>" against the stored token.
export function verifyBearer(authorization: string | null): boolean {
  const stored = getApiToken();
  if (!stored || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7).trim();
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}

// -------------------------------------------------------------------- outbox

export type OutboxChannel = "email" | "slack" | "teams" | "webhook";

export interface OutboxRow {
  id: number;
  channel: OutboxChannel;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  spot_buy_id: number | null;
  status: "logged" | "sent" | "failed";
  error: string | null;
  created_at: string;
}

export function addOutbox(row: {
  channel: OutboxChannel;
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  spot_buy_id?: number | null;
  status?: "logged" | "sent" | "failed";
  error?: string | null;
}): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO outbox (channel,recipient,subject,body,spot_buy_id,status,error,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      row.channel,
      row.recipient ?? null,
      row.subject ?? null,
      row.body ?? null,
      row.spot_buy_id ?? null,
      row.status ?? "logged",
      row.error ?? null,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

export function listOutbox(limit = 25): OutboxRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM outbox ORDER BY id DESC LIMIT ?")
    .all(limit) as OutboxRow[];
}

function setOutboxStatus(id: number, status: "sent" | "failed", error?: string): void {
  const db = getDb();
  db.prepare("UPDATE outbox SET status=?, error=? WHERE id=?").run(
    status,
    error ?? null,
    id
  );
}

// ---- notification channels (#12) -------------------------------------------

export interface NotificationChannel {
  id: number;
  label: string;
  channel: OutboxChannel;
  target: string;
  events: string; // JSON array
  enabled: number;
  created_at: string;
}

export function listChannels(): NotificationChannel[] {
  return getDb().prepare("SELECT * FROM notification_channels ORDER BY id").all() as NotificationChannel[];
}

export function addChannel(input: {
  label: string;
  channel: OutboxChannel;
  target: string;
  events?: string[];
}): number {
  const info = getDb()
    .prepare(
      "INSERT INTO notification_channels (label,channel,target,events,enabled,created_at) VALUES (?,?,?,?,1,?)"
    )
    .run(input.label, input.channel, input.target, JSON.stringify(input.events ?? []), nowIso());
  return Number(info.lastInsertRowid);
}

export function setChannelEnabled(id: number, enabled: boolean): void {
  getDb().prepare("UPDATE notification_channels SET enabled=? WHERE id=?").run(enabled ? 1 : 0, id);
}

export function deleteChannel(id: number): void {
  getDb().prepare("DELETE FROM notification_channels WHERE id=?").run(id);
}

// Reject webhook targets that point at internal infrastructure (SSRF guard).
// Must be http(s) and not a loopback / private / link-local / metadata host.
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return false;
  // Cloud metadata endpoints.
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
  // IPv6 loopback / link-local / unique-local.
  if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return false;
  // IPv4 private / loopback / link-local ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

// Post a JSON payload to a chat webhook (Slack/Teams/generic) with a timeout.
async function postWebhook(
  channel: OutboxChannel,
  url: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSafeWebhookUrl(url)) return { ok: false, error: "Blocked: unsafe webhook host" };
  // Slack uses {text}; Teams uses {text} on the legacy connector too — both accept it.
  const body = channel === "teams" ? { text } : { text };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

// Record + deliver an internal notification to every enabled channel that
// subscribes to this event (empty subscription = all events). Legacy single
// slack_webhook_url setting is still honored. Falls back to 'logged' with none.
export async function notify(
  text: string,
  spotBuyId: number | null,
  eventKey = "approval"
): Promise<"sent" | "failed" | "logged"> {
  const targets: { channel: OutboxChannel; url: string }[] = [];

  const legacySlack = getSetting("slack_webhook_url");
  if (legacySlack) targets.push({ channel: "slack", url: legacySlack });

  for (const c of listChannels()) {
    if (!c.enabled || c.channel === "email") continue;
    const events = safeArrayJson(c.events);
    if (events.length === 0 || events.includes(eventKey)) {
      targets.push({ channel: c.channel, url: c.target });
    }
  }

  if (targets.length === 0) {
    addOutbox({ channel: "slack", recipient: null, body: text, spot_buy_id: spotBuyId });
    return "logged";
  }

  let anyFailed = false;
  for (const t of targets) {
    const id = addOutbox({ channel: t.channel, recipient: `${t.channel} webhook`, body: text, spot_buy_id: spotBuyId });
    const r = await postWebhook(t.channel, t.url, text);
    if (r.ok) setOutboxStatus(id, "sent");
    else {
      setOutboxStatus(id, "failed", r.error);
      anyFailed = true;
    }
  }
  return anyFailed ? "failed" : "sent";
}

function safeArrayJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ---- email transport (#2) --------------------------------------------------
// Real SMTP delivery when SMTP_* env is set (via optional nodemailer). Without
// it, email rows stay 'logged' in the outbox — a complete record either way.
function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function sendSmtp(
  to: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Dynamic, optional import — the package is only needed if SMTP is enabled.
    // webpackIgnore keeps the bundler from trying to resolve an optional dep.
    const nodemailer: any = await import(/* webpackIgnore: true */ "nodemailer").catch(() => null);
    if (!nodemailer) return { ok: false, error: "nodemailer not installed" };
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text: body });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "smtp error" };
  }
}

// Deliver any 'logged' email rows via SMTP (called after email-generating actions
// and by the cron endpoint). No-op when SMTP is not configured.
export async function deliverPendingEmails(limit = 50): Promise<{ sent: number; failed: number }> {
  if (!smtpConfigured()) return { sent: 0, failed: 0 };
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM outbox WHERE channel='email' AND status='logged' ORDER BY id DESC LIMIT ?")
    .all(limit) as OutboxRow[];
  let sent = 0, failed = 0;
  for (const r of rows) {
    if (!r.recipient || !r.recipient.includes("@")) continue; // only real addresses
    const res = await sendSmtp(r.recipient, r.subject ?? "Wovi Reserve", r.body ?? "");
    if (res.ok) { setOutboxStatus(r.id, "sent"); sent++; }
    else { setOutboxStatus(r.id, "failed", res.error); failed++; }
  }
  return { sent, failed };
}

export function emailConfigured(): boolean {
  return smtpConfigured();
}

// ------------------------------------------------------- vendor master import

// Minimal CSV parser with quoted-field support.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  }
  return rows;
}

export interface VendorImportResult {
  created: number;
  updated: number;
  contacts: number;
  errors: string[];
}

// Import an ERP vendor-master export. Columns:
//   name,country,region,materials,capabilities,contact_name,contact_email
// (materials/capabilities are ';'-separated). Upserts suppliers by name.
export function importVendorsCsv(csv: string): VendorImportResult {
  const db = getDb();
  const result: VendorImportResult = { created: 0, updated: 0, contacts: 0, errors: [] };
  const rows = parseCsv(csv);
  if (!rows.length) {
    result.errors.push("No rows found.");
    return result;
  }
  // Skip a header row if present.
  let start = 0;
  if (rows[0][0]?.trim().toLowerCase() === "name") start = 1;

  const tx = db.transaction(() => {
    for (let r = start; r < rows.length; r++) {
      const [name, country, region, materials, capabilities, contactName, contactEmail] =
        rows[r].map((c) => (c ?? "").trim());
      if (!name) {
        result.errors.push(`Row ${r + 1}: missing name — skipped.`);
        continue;
      }
      const mats = JSON.stringify(
        (materials || "").split(";").map((m) => m.trim()).filter(Boolean)
      );
      const caps = JSON.stringify(
        (capabilities || "").split(";").map((c) => c.trim()).filter(Boolean)
      );
      const existing = db
        .prepare(
          "SELECT id FROM organizations WHERE lower(name)=lower(?) AND kind='supplier'"
        )
        .get(name) as { id: number } | undefined;

      let orgId: number;
      if (existing) {
        db.prepare(
          "UPDATE organizations SET country=?, region=?, materials=?, capabilities=? WHERE id=?"
        ).run(country || null, region || null, mats, caps, existing.id);
        orgId = existing.id;
        result.updated++;
      } else {
        const info = db
          .prepare(
            `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
             VALUES (?,'supplier',?,?,?,?,?,?)`
          )
          .run(
            name,
            country || null,
            region || null,
            mats,
            caps,
            "Imported from vendor master",
            nowIso()
          );
        orgId = Number(info.lastInsertRowid);
        result.created++;
      }

      if (contactName) {
        const person = db
          .prepare(
            "SELECT id FROM people WHERE org_id=? AND (lower(name)=lower(?) OR (email IS NOT NULL AND lower(email)=lower(?)))"
          )
          .get(orgId, contactName, contactEmail || "") as { id: number } | undefined;
        if (person) {
          db.prepare("UPDATE people SET email=COALESCE(?,email) WHERE id=?").run(
            contactEmail || null,
            person.id
          );
        } else {
          db.prepare(
            `INSERT INTO people (name,org_id,title,whatsapp,wechat,phone,email,notes,created_at)
             VALUES (?,?,?,NULL,NULL,NULL,?,?,?)`
          ).run(
            contactName,
            orgId,
            "Supplier contact",
            contactEmail || null,
            "Imported from vendor master",
            nowIso()
          );
          result.contacts++;
        }
      }
    }
  });
  tx();
  return result;
}

// --------------------------------------------------------------- DOA editing

export function addDoaRule(
  role: string,
  minAmount: number,
  maxAmount: number | null,
  approverPersonId: number | null
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO doa_rules (role,min_amount,max_amount,approver_person_id,org_id) VALUES (?,?,?,?,NULL)"
  ).run(role, minAmount, maxAmount, approverPersonId);
}

export function deleteDoaRule(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM doa_rules WHERE id=?").run(id);
}
