import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runSeed } from "./seed.mjs";

// DB location, in priority order:
//  1. WOVI_DB_PATH — explicit (mount a persistent volume for real hosting).
//  2. /tmp on Vercel — serverless has a read-only fs except /tmp (ephemeral).
//  3. the project root — local dev.
const DB_PATH =
  process.env.WOVI_DB_PATH ||
  (process.env.VERCEL ? "/tmp/wovi.db" : path.join(process.cwd(), "wovi.db"));
const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

// On Vercel (ephemeral /tmp) or when WOVI_AUTOSEED=on, load the demo dataset the
// first time an empty database is opened, so a fresh serverless instance shows a
// populated, clickable app. Local dev stays empty by default.
const AUTOSEED = process.env.VERCEL != null || process.env.WOVI_AUTOSEED === "on";

// Cache the connection across hot-reloads in dev (Next re-evaluates modules).
const globalForDb = globalThis as unknown as {
  __woviDb?: Database.Database;
};

// Add a column to an existing table only if it is missing (idempotent migration
// for databases created before a column was added to schema.sql).
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrate(db: Database.Database): void {
  // Columns added to existing tables after their initial CREATE.
  addColumnIfMissing(db, "spot_buys", "base_currency", "base_currency TEXT NOT NULL DEFAULT 'USD'");
  addColumnIfMissing(db, "spot_buys", "version", "version INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "requisitions", "total_value_base", "total_value_base REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "requisitions", "submitted_by_person_id", "submitted_by_person_id INTEGER");
  addColumnIfMissing(db, "audit_events", "prev_hash", "prev_hash TEXT");
  addColumnIfMissing(db, "audit_events", "hash", "hash TEXT");
  addColumnIfMissing(db, "spot_buy_lines", "unit_price", "unit_price REAL NOT NULL DEFAULT 0");
}

function seedDefaults(db: Database.Database): void {
  // Baseline FX rates (rate_to_usd = USD per 1 unit). Editable on integrations.
  const fxCount = (db.prepare("SELECT COUNT(*) c FROM fx_rates").get() as { c: number }).c;
  if (fxCount === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare(
      "INSERT INTO fx_rates (currency,rate_to_usd,updated_at) VALUES (?,?,?)"
    );
    const defaults: [string, number][] = [
      ["USD", 1], ["EUR", 1.08], ["GBP", 1.27], ["JPY", 0.0064],
      ["CNY", 0.14], ["TRY", 0.031], ["NOK", 0.093], ["CAD", 0.73],
      ["MXN", 0.058], ["INR", 0.012], ["KRW", 0.00073],
    ];
    for (const [c, r] of defaults) ins.run(c, r, now);
  }
}

function init(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000"); // wait rather than throw under concurrent writes

  // Create schema if tables don't exist (CREATE TABLE IF NOT EXISTS throughout).
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  migrate(db);
  seedDefaults(db);

  // Make the connection visible before seeding so any getDb() call during the
  // seed run resolves to this same instance (no re-entrancy loop).
  globalForDb.__woviDb = db;

  // Local dev starts EMPTY (load with `npm run seed:demo`). On Vercel / autoseed,
  // populate an empty database once so the demo link is immediately usable.
  if (AUTOSEED) {
    const orgs = (db.prepare("SELECT COUNT(*) c FROM organizations").get() as { c: number }).c;
    if (orgs === 0) {
      try {
        runSeed(db);
      } catch {
        /* seeding is best-effort for the demo — never block boot */
      }
    }
  }
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__woviDb) {
    return init();
  }
  return globalForDb.__woviDb;
}
