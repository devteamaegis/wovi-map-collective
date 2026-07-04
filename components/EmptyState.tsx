import { NetworkMotif } from "./NetworkMotif";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-rule bg-white px-6 py-10 text-center">
      <NetworkMotif
        light={false}
        className="pointer-events-none absolute inset-x-0 -top-2 mx-auto w-[420px] opacity-40"
      />
      <div className="relative">
        <h3 className="serif text-lg text-ink">{title}</h3>
        {description ? (
          <p className="text-sm text-ink-3 mt-1.5 max-w-md mx-auto">{description}</p>
        ) : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
