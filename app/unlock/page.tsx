import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/Page";
import { Eyebrow } from "@/components/Eyebrow";
import { unlockAction } from "./actions";
import { isUnlocked, RUN_LIMIT } from "@/lib/paywall";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unlock full access" };

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;
  if (await isUnlocked()) redirect("/");

  return (
    <PageContainer className="max-w-md">
      <div className="mt-8 rounded-2xl border border-rule bg-white p-6 shadow-card sm:mt-12 sm:p-8">
        <Eyebrow>Demo access</Eyebrow>
        <h1 className="serif mt-3 text-2xl leading-tight text-ink">
          You&rsquo;ve used your {RUN_LIMIT} free runs
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          Tell us who you are and we&rsquo;ll unlock the full working demo —
          create unlimited needs and spot buys — and follow up with a walkthrough
          tailored to your supply chain.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-[#fbe9e7] px-3 py-2 text-[13px] text-danger">
            Please enter a valid work email.
          </p>
        ) : null}

        <form action={unlockAction} className="mt-5 space-y-3">
          <input type="hidden" name="from" value={from ?? ""} />
          <div>
            <label className="label" htmlFor="lead-name">
              Name
            </label>
            <input
              id="lead-name"
              name="name"
              className="field"
              placeholder="Jane Cooper"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="lead-email">
              Work email
            </label>
            <input
              id="lead-email"
              name="email"
              type="email"
              required
              className="field"
              placeholder="jane@company.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="lead-company">
              Company
            </label>
            <input
              id="lead-company"
              name="company"
              className="field"
              placeholder="Company Inc."
              autoComplete="organization"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Unlock full access
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-ink-3">
          Just exploring?{" "}
          <Link href="/" className="link-accent">
            Back to dashboard
          </Link>
        </p>
      </div>
    </PageContainer>
  );
}
