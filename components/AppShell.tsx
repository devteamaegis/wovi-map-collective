import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { TopBar } from "./TopBar";
import { NetworkMotif } from "./NetworkMotif";
import { OnboardingProvider } from "./onboarding/OnboardingProvider";
import { TourButton } from "./onboarding/TourButton";
import { PaywallBanner } from "./PaywallBanner";
import { currentUser, authEnabled } from "@/lib/auth";
import { isUnlocked, runsUsed } from "@/lib/paywall";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // Unauthenticated (auth on) → render the page bare (login/setup supply their
  // own full-screen layout); the middleware already gates protected routes.
  if (authEnabled() && !user) {
    return <>{children}</>;
  }

  const sessionUser = user
    ? { name: user.name, email: user.email, role: user.role }
    : null;

  // Show the demo free-run meter only to anonymous visitors who haven't unlocked.
  const showPaywall = !user && !(await isUnlocked());
  const runsSoFar = showPaywall ? await runsUsed() : 0;

  return (
    <OnboardingProvider>
      {/* Skip link — first tab stop; lets keyboard users bypass the nav (WCAG 2.4.1) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        {/* Sidebar (desktop) — scrollable so nav + footer stay reachable when tall / zoomed */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-navy text-white lg:flex">
          <div className="relative px-5 pt-6 pb-5">
            <NetworkMotif className="pointer-events-none absolute -right-6 top-2 w-40 opacity-30" />
            <Link href="/" className="relative inline-flex flex-col">
              <span className="serif text-2xl tracking-tight">Wovi</span>
              <span className="eyebrow eyebrow--light mt-2">Broker Console</span>
            </Link>
          </div>

          <div className="px-3 py-2" data-tour="sidebar-nav">
            <NavLinks />
          </div>

          <div className="mt-auto space-y-3 px-5 pb-6 pt-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
              <p className="serif text-[13px] leading-snug text-white/85">
                The manual work is{" "}
                <span className="italic text-accent-2">the moat.</span>
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                Every consented intro compounds into the graph.
              </p>
            </div>
            <TourButton />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={sessionUser} />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            {showPaywall ? <PaywallBanner used={runsSoFar} /> : null}
            {children}
          </main>
        </div>
      </div>
    </OnboardingProvider>
  );
}
