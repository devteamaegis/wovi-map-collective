// Typed surface for the seed routine. Implementation lives in seed.mjs so the
// same code seeds both the live app (lib/db.ts) and the standalone reset script.
import type BetterSqlite3 from "better-sqlite3";

import { runSeed as _runSeed } from "./seed.mjs";

export function runSeed(db: BetterSqlite3.Database): void {
  _runSeed(db);
}
