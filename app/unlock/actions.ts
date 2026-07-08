"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { insertLead } from "@/lib/repos/leads";
import { unlock } from "@/lib/paywall";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function unlockAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim() || null;
  const company = String(formData.get("company") || "").trim() || null;
  const from = String(formData.get("from") || "").trim();

  if (!EMAIL_RE.test(email)) {
    redirect(`/unlock?from=${encodeURIComponent(from)}&error=1`);
  }

  try {
    insertLead({ name, email, company, source: from || null });
  } catch {
    /* the demo DB is ephemeral — capture is best-effort, never block unlock */
  }

  await unlock();
  // Drop the paywall banner immediately on the post-unlock navigation.
  revalidatePath("/", "layout");
  redirect(
    from === "needs" ? "/needs/new" : from === "reserve" ? "/reserve/new" : "/"
  );
}
