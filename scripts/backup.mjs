// Online SQLite backup (#4). Uses better-sqlite3's .backup() (safe while the app
// is running, WAL-aware) to write a timestamped copy under WOVI_BACKUP_DIR (else
// ./backups). Schedule it via cron: `node scripts/backup.mjs`. Prunes to the
// most recent WOVI_BACKUP_KEEP (default 14).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.WOVI_DB_PATH || path.join(process.cwd(), "wovi.db");
const dir = process.env.WOVI_BACKUP_DIR || path.join(process.cwd(), "backups");
const keep = Number(process.env.WOVI_BACKUP_KEEP || 14);

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });

// Timestamp without ':' for filesystem safety (no Date.now ban here — plain node).
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(dir, `wovi-${stamp}.db`);

const db = new Database(dbPath, { readonly: true });
await db.backup(dest);
db.close();

const size = fs.statSync(dest).size;
console.log(`Backup written: ${dest} (${(size / 1024).toFixed(0)} KB)`);

// Prune old backups.
const backups = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("wovi-") && f.endsWith(".db"))
  .sort()
  .reverse();
for (const old of backups.slice(keep)) {
  fs.unlinkSync(path.join(dir, old));
  console.log(`Pruned old backup: ${old}`);
}
