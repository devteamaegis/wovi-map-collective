import { Eyebrow } from "./Eyebrow";

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        accent
          ? "bg-accent-pale border-[#cdddec]"
          : "bg-white border-rule"
      }`}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="serif text-2xl leading-none mt-3 tabular-nums sm:text-3xl">
        {value}
      </div>
      {hint ? <div className="text-[12px] text-ink-3 mt-1.5">{hint}</div> : null}
    </div>
  );
}
