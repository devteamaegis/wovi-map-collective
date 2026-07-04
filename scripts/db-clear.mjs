// Wipe ALL data (Wovi + Reserve) while keeping the schema. Row-level deletes so
// it is safe to run while a dev server holds the database open (WAL mode).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const db = new Database(path.join(root, "wovi.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure schema exists so the deletes below never hit a missing table.
db.exec(fs.readFileSync(path.join(root, "lib", "schema.sql"), "utf8"));

// FK-safe order: children before parents. fx_rates + app_settings (config) are
// intentionally preserved.
db.exec(`
  DELETE FROM sessions;
  DELETE FROM attachments;
  DELETE FROM goods_receipts;
  DELETE FROM outbox;
  DELETE FROM audit_events;
  DELETE FROM po_lines;
  DELETE FROM customs_packets;
  DELETE FROM purchase_orders;
  DELETE FROM approvals;
  DELETE FROM requisitions;
  DELETE FROM quotes;
  DELETE FROM rfq_invites;
  DELETE FROM rfqs;
  DELETE FROM doa_rules;
  DELETE FROM scheduled_jobs;
  DELETE FROM spot_buy_lines;
  DELETE FROM spot_buys;
  DELETE FROM rate_limits;
  DELETE FROM notification_channels;
  DELETE FROM users;
  DELETE FROM outcomes;
  DELETE FROM consents;
  DELETE FROM outreach;
  DELETE FROM path_hops;
  DELETE FROM paths;
  DELETE FROM edges;
  DELETE FROM needs;
  DELETE FROM people;
  DELETE FROM organizations;
`);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all();
let total = 0;
for (const t of tables) {
  total += db.prepare(`SELECT COUNT(*) c FROM ${t.name}`).get().c;
}
console.log(`Database cleared — ${tables.length} tables, ${total} rows remaining.`);
console.log("The app now starts empty. Load demo data anytime with: npm run seed:demo");
db.close();
