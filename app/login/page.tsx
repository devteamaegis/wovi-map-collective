import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth/actions";
import { userCount, authEnabled } from "@/lib/auth";
import { AuthCard } from "@/components/auth/AuthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (!authEnabled()) redirect("/");
  if (userCount() === 0) redirect("/setup");
  const sp = await searchParams;

  return (
    <AuthCard
      title="Sign in to Reserve"
      subtitle="The urgent-buy execution engine. Every action is attributed and audited."
    >
      <form action={loginAction} className="space-y-3">
        <input type="hidden" name="next" value={sp.next || "/"} />
        {sp.error ? (
          <p className="rounded-lg border border-[#ecccc8] bg-[#f7e6e4] px-3 py-2 text-[13px] text-[#9b3f37]">
            Incorrect email or password.
          </p>
        ) : null}
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-wide text-ink-3">Email</span>
          <input name="email" type="email" required autoFocus className="field mt-1 w-full" placeholder="you@company.com" />
        </label>
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-wide text-ink-3">Password</span>
          <input name="password" type="password" required className="field mt-1 w-full" placeholder="••••••••" />
        </label>
        <button type="submit" className="btn btn-primary w-full">Sign in</button>
      </form>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        SSO (OIDC/SAML) plugs in at <code className="mono text-[11px]">app/auth/actions.ts</code>;
        password login is the built-in fallback.
      </p>
    </AuthCard>
  );
}
