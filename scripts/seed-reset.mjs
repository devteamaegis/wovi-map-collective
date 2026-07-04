// Standalone wipe-and-reseed. Runs outside Next so `npm run seed:reset` leaves a
// fully seeded wovi.db without needing the dev server. Shares the exact same
// seed logic the app uses (lib/seed.mjs) so data is identical either way.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runSeed } from "../lib/seed.mjs";

const root = process.cwd();
const dbPath = path.join(root, "wovi.db");
const schemaPath = path.join(root, "lib", "schema.sql");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure schema exists.
db.exec(fs.readFileSync(schemaPath, "utf8"));

// Wipe in FK-safe order (children before parents).
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

runSeed(db);

const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
const avg = db.prepare("SELECT AVG(confidence) AS a FROM edges").get().a;

console.log("Wovi database reseeded:");
console.log(`  organizations : ${count("organizations")}`);
console.log(`  people        : ${count("people")}`);
console.log(`  needs         : ${count("needs")}`);
console.log(`  paths         : ${count("paths")}`);
console.log(`  edges         : ${count("edges")} (avg confidence ${Math.round(avg)})`);
console.log(`  outreach      : ${count("outreach")}`);
console.log(`  consents      : ${count("consents")}`);
console.log(`  outcomes      : ${count("outcomes")}`);
db.close();
