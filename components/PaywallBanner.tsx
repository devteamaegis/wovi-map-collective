import Link from "next/link";
import { Lock } from "lucide-react";
import { RUN_LIMIT } from "@/lib/paywall";

// Slim strip at the top of the app for anonymous demo visitors, so the free-run
// limit is understood before it's hit (never a surprise wall).
export function PaywallBanner({ used }: { used: number }) {
  const left = Math.max(0, RUN_LIMIT - used);
  const exhausted = left === 0;
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-[12px] ${
        exhausted
          ? "bg-[#fbe9e7] text-danger"
          : "bg-accent-pale text-[#2f4d68]"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Lock size={12} />
        {exhausted
          ? "You've used all your free runs in this demo."
          : `${left} of ${RUN_LIMIT} free run${left === 1 ? "" : "s"} left in this demo.`}
      </span>
      <Link href="/unlock" className="font-medium underline underline-offset-2">
        Unlock full access
      </Link>
    </div>
  );
}
