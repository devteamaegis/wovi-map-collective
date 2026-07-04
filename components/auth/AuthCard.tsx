import { NetworkMotif } from "@/components/NetworkMotif";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-navy px-6 py-6 text-white">
          <NetworkMotif className="pointer-events-none absolute -right-8 -top-6 w-44 opacity-30" />
          <span className="serif relative text-2xl tracking-tight">Wovi</span>
          <span className="eyebrow eyebrow--light relative mt-2 block">Reserve</span>
        </div>
        <h1 className="serif text-xl text-ink">{title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
