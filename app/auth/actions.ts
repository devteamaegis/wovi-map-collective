"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getUserByEmail,
  verifyPassword,
  createUser,
  userCount,
  requireUser,
  setUserRole,
  setUserActive,
  linkUserPerson,
  type Role,
} from "@/lib/auth";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 12 * 3600,
};

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/") || "/";

  const user = getUserByEmail(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const ua = (await headers()).get("user-agent");
  const raw = createSession(user!.id, ua);
  (await cookies()).set(SESSION_COOKIE, raw, COOKIE_OPTS);
  // Only same-origin absolute paths — reject protocol-relative ("//evil.com")
  // and backslash ("/\evil.com") open-redirect payloads.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/";
  redirect(safeNext);
}

export async function logoutAction() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) destroySession(raw);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// First-run: create the initial admin account when no users exist yet.
export async function setupAction(formData: FormData) {
  if (userCount() > 0) redirect("/login");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 8) {
    redirect("/setup?error=1");
  }
  const id = createUser({ name, email, password, role: "admin" });
  const raw = createSession(id, (await headers()).get("user-agent"));
  (await cookies()).set(SESSION_COOKIE, raw, COOKIE_OPTS);
  redirect("/");
}

// ---- admin: user management -------------------------------------------------
export async function createUserAction(formData: FormData) {
  await requireUser(["admin"]);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const role = (String(formData.get("role") || "viewer") as Role);
  const personId = formData.get("person_id") ? Number(formData.get("person_id")) : null;
  if (!name || !email) return;
  const id = createUser({ name, email, password: password || null, role });
  if (personId) linkUserPerson(id, personId);
  revalidatePath("/", "layout");
}
export async function setRoleAction(userId: number, role: Role) {
  await requireUser(["admin"]);
  setUserRole(userId, role);
  revalidatePath("/", "layout");
}
export async function setActiveAction(userId: number, active: boolean) {
  await requireUser(["admin"]);
  setUserActive(userId, active);
  revalidatePath("/", "layout");
}
export async function linkPersonAction(userId: number, personId: number | null) {
  await requireUser(["admin"]);
  linkUserPerson(userId, personId);
  revalidatePath("/", "layout");
}
