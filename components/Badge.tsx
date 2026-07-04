export type Tone =
  | "neutral"
  | "accent"
  | "good"
  | "warn"
  | "danger"
  | "navy"
  | "buyer"
  | "supplier"
  | "broker"
  | "facility";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2 border-rule",
  accent: "bg-accent-pale text-[#2f4d68] border-[#cdddec]",
  good: "bg-[#e4efea] text-[#2c5d4e] border-[#c5ddd4]",
  warn: "bg-[#f6ecdc] text-[#8a5d21] border-[#e7d4b6]",
  danger: "bg-[#f7e6e4] text-[#9b3f37] border-[#ecccc8]",
  navy: "bg-navy text-white border-navy",
  buyer: "bg-[#e7edf4] text-[#33506f] border-[#cfdcea]",
  supplier: "bg-[#e9efe9] text-[#3c5d42] border-[#d2e0d2]",
  broker: "bg-[#efe9f1] text-[#5b4566] border-[#ddd0e0]",
  facility: "bg-[#efece5] text-[#5e5640] border-[#ddd6c8]",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ---- Domain value → label + tone maps --------------------------------------

export function orgKindBadge(kind: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    buyer: { label: "Buyer", tone: "buyer" },
    supplier: { label: "Supplier", tone: "supplier" },
    broker: { label: "Broker", tone: "broker" },
    facility: { label: "Facility", tone: "facility" },
  };
  return map[kind] ?? { label: kind, tone: "neutral" };
}

export function consentBadge(status: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    double_opt_in: { label: "Double opt-in", tone: "good" },
    one_sided: { label: "One-sided", tone: "warn" },
    none: { label: "No consent", tone: "neutral" },
  };
  return map[status] ?? { label: status, tone: "neutral" };
}

export function needStatusBadge(status: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    open: { label: "Open", tone: "accent" },
    brokering: { label: "Brokering", tone: "navy" },
    matched: { label: "Matched", tone: "good" },
    closed: { label: "Closed", tone: "neutral" },
  };
  return map[status] ?? { label: status, tone: "neutral" };
}

export function pathStatusBadge(status: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    proposed: { label: "Proposed", tone: "neutral" },
    outreach: { label: "Outreach", tone: "accent" },
    awaiting_consent: { label: "Awaiting consent", tone: "warn" },
    consented: { label: "Consented", tone: "good" },
    declined: { label: "Declined", tone: "danger" },
    dead: { label: "Dead end", tone: "neutral" },
  };
  return map[status] ?? { label: status, tone: "neutral" };
}

export function priorityBadge(p: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    high: { label: "High", tone: "danger" },
    med: { label: "Medium", tone: "warn" },
    low: { label: "Low", tone: "neutral" },
  };
  return map[p] ?? { label: p, tone: "neutral" };
}

export function edgeKindBadge(kind: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    knows: { label: "knows", tone: "neutral" },
    introduced_by: { label: "introduced by", tone: "accent" },
    brokered_intro: { label: "brokered intro", tone: "navy" },
    sources_from: { label: "sources from", tone: "accent" },
    supplies: { label: "supplies", tone: "supplier" },
  };
  return map[kind] ?? { label: kind, tone: "neutral" };
}

export function consentRecordBadge(status: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    pending: { label: "Pending", tone: "warn" },
    granted: { label: "Granted", tone: "good" },
    refused: { label: "Refused", tone: "danger" },
    revoked: { label: "Revoked", tone: "neutral" },
  };
  return map[status] ?? { label: status, tone: "neutral" };
}

export function outcomeBadge(result: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    consented_intro: { label: "Consented intro", tone: "good" },
    sourced: { label: "Sourced", tone: "good" },
    corrected: { label: "Corrected", tone: "accent" },
    declined: { label: "Declined", tone: "danger" },
    dead_end: { label: "Dead end", tone: "neutral" },
  };
  return map[result] ?? { label: result, tone: "neutral" };
}
