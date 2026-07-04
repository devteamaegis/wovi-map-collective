import { redirect } from "next/navigation";
import { setupAction } from "@/app/auth/actions";
import { userCount, authEnabled } from "@/lib/auth";
import { AuthCard } from "@/components/auth/AuthCard";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!authEnabled()) redirect("/");
  if (userCount() > 0) redirect("/login");
  const sp = await searchParams;

  return (
    <AuthCard
      title="Create the first admin"
      subtitle="No accounts exist yet. This account can invite the rest of the team and set the DOA matrix."
    >
      <form action={setupAction} className="space-y-3">
        {sp.error ? (
          <p className="rounded-lg border border-[#ecccc8] bg-[#f7e6e4] px-3 py-2 text-[13px] text-[#9b3f37]">
            Check the fields — password must be at least 8 characters.
          </p>
        ) : null}
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-wide text-ink-3">Full name</span>
          <input name="name" required autoFocus className="field mt-1 w-full" placeholder="Jordan Rivera" />
        </label>
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-wide text-ink-3">Email</span>
          <input name="email" type="email" required className="field mt-1 w-full" placeholder="you@company.com" />
        </label>
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-wide text-ink-3">Password</span>
          <input name="password" type="password" required minLength={8} className="field mt-1 w-full" placeholder="At least 8 characters" />
        </label>
        <button type="submit" className="btn btn-primary w-full">Create admin & continue</button>
      </form>
    </AuthCard>
  );
}
