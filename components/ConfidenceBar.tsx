// Confidence → subtle blue ramp. Higher confidence = deeper accent.
function rampColor(v: number): string {
  if (v >= 80) return "#3f5f7f";
  if (v >= 60) return "#4a6e92";
  if (v >= 40) return "#6e93b6";
  if (v >= 20) return "#9bb4cd";
  return "#c2d2e0";
}

export function ConfidenceBar({
  value,
  showValue = true,
  className = "",
  width = "w-full",
}: {
  value: number;
  showValue?: boolean;
  className?: string;
  width?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${width} h-1.5 rounded-full bg-paper-3 overflow-hidden`}
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${v}%`, background: rampColor(v) }}
        />
      </div>
      {showValue ? (
        <span className="mono text-[11px] text-ink-2 tabular-nums w-7 text-right">
          {v}
        </span>
      ) : null}
    </div>
  );
}
