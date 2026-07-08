import "server-only";
import { cookies } from "next/headers";

// Lightweight demo funnel: an anonymous visitor gets a handful of free "runs"
// (creating a spot buy or a need). After that, a lead-capture wall unlocks
// unlimited use. State lives entirely in the visitor's cookies — no server
// state — so it survives the ephemeral serverless DB. Signed-in users are
// never metered (the calling actions skip the gate when a session exists).
export const RUN_LIMIT = 3;

const RUNS_COOKIE = "wovi_runs";
const UNLOCK_COOKIE = "wovi_unlocked";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export async function runsUsed(): Promise<number> {
  const c = await cookies();
  const n = parseInt(c.get(RUNS_COOKIE)?.value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function isUnlocked(): Promise<boolean> {
  const c = await cookies();
  return c.get(UNLOCK_COOKIE)?.value === "1";
}

export async function runsRemaining(): Promise<number> {
  if (await isUnlocked()) return Infinity;
  return Math.max(0, RUN_LIMIT - (await runsUsed()));
}

/** Call before a metered create. `allowed: false` means the wall should show. */
export async function gateRun(): Promise<{ allowed: boolean; remaining: number }> {
  if (await isUnlocked()) return { allowed: true, remaining: Infinity };
  const used = await runsUsed();
  if (used >= RUN_LIMIT) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: RUN_LIMIT - used };
}

/** Count one metered run (no-op once unlocked). Call only after a successful create. */
export async function recordRun(): Promise<void> {
  if (await isUnlocked()) return;
  const used = await runsUsed();
  const c = await cookies();
  c.set(RUNS_COOKIE, String(used + 1), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Mark this browser as unlocked after lead capture. */
export async function unlock(): Promise<void> {
  const c = await cookies();
  c.set(UNLOCK_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}
