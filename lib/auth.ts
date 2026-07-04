import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { nowIso } from "./repos/util";
import { SESSION_COOKIE } from "./auth-constants";

export { SESSION_COOKIE };
const SESSION_TTL_HOURS = 12;

export type Role = "admin" | "broker" | "buyer" | "approver" | "viewer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  person_id: number | null;
  active: number;
  created_at: string;
  last_login_at: string | null;
}

// ---- password hashing (scrypt, no external dependency) ----------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// ---- users ------------------------------------------------------------------

export function userCount(): number {
  return (getDb().prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;
}

export function getUserByEmail(email: string): (User & { password_hash: string | null }) | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM users WHERE lower(email)=lower(?)")
      .get(email.trim()) as (User & { password_hash: string | null }) | undefined) ?? null
  );
}

export function getUserById(id: number): User | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE id=?").get(id) as User | undefined) ?? null;
}

export function listUsers(): User[] {
  return getDb().prepare("SELECT * FROM users ORDER BY id").all() as User[];
}

export function createUser(input: {
  name: string;
  email: string;
  password?: string | null;
  role: Role;
  person_id?: number | null;
}): number {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO users (name,email,password_hash,role,person_id,active,created_at)
       VALUES (?,?,?,?,?,1,?)`
    )
    .run(
      input.name.trim(),
      input.email.trim(),
      input.password ? hashPassword(input.password) : null,
      input.role,
      input.person_id ?? null,
      nowIso()
    );
  return Number(info.lastInsertRowid);
}

export function setUserRole(userId: number, role: Role): void {
  getDb().prepare("UPDATE users SET role=? WHERE id=?").run(role, userId);
}

export function setUserActive(userId: number, active: boolean): void {
  getDb().prepare("UPDATE users SET active=? WHERE id=?").run(active ? 1 : 0, userId);
}

export function linkUserPerson(userId: number, personId: number | null): void {
  getDb().prepare("UPDATE users SET person_id=? WHERE id=?").run(personId, userId);
}

// ---- sessions ---------------------------------------------------------------

// The cookie holds a raw random token; only its sha256 is stored, so a leaked DB
// does not expose usable session tokens.
function tokenHash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function createSession(userId: number, userAgent?: string | null): string {
  const db = getDb();
  const raw = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_HOURS * 3600 * 1000);
  db.prepare(
    "INSERT INTO sessions (token,user_id,created_at,expires_at,user_agent) VALUES (?,?,?,?,?)"
  ).run(tokenHash(raw), userId, now.toISOString(), expires.toISOString(), userAgent ?? null);
  db.prepare("UPDATE users SET last_login_at=? WHERE id=?").run(now.toISOString(), userId);
  return raw;
}

export function destroySession(raw: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(raw));
}

function userForToken(raw: string): User | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token=? AND s.expires_at > ? AND u.active=1`
    )
    .get(tokenHash(raw), nowIso()) as User | undefined;
  return row ?? null;
}

// Resolve the logged-in user from the request cookie (server components/actions).
export async function currentUser(): Promise<User | null> {
  if (!authEnabled()) return null;
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return userForToken(raw);
}

// Sign-in is OPT-IN: the app runs open unless WOVI_AUTH=on. All the auth code
// (login/setup/roles/SoD) stays intact and re-enables with that one env var.
export function authEnabled(): boolean {
  return process.env.WOVI_AUTH === "on";
}

// The directory person acting, for audit/SoD. Falls back to null (system).
export async function actingPersonId(): Promise<number | null> {
  const u = await currentUser();
  return u?.person_id ?? null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "unauthenticated" | "forbidden" | "sod" = "forbidden"
  ) {
    super(message);
  }
}

// Guard a server action: require a logged-in user, optionally with one of roles.
export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) {
    if (!authEnabled()) {
      // Auth disabled — synthesize an admin so actions still work locally.
      return {
        id: 0, name: "Local", email: "local@wovi", role: "admin",
        person_id: null, active: 1, created_at: nowIso(), last_login_at: null,
      };
    }
    throw new AuthError("Not signed in", "unauthenticated");
  }
  if (roles && !roles.includes(u.role) && u.role !== "admin") {
    throw new AuthError(`Requires role: ${roles.join(" or ")}`, "forbidden");
  }
  return u;
}
