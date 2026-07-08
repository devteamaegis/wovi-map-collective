import type { Tone } from "@/components/Badge";

const T = (label: string, tone: Tone) => ({ label, tone });

export function triggerBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    line_down: T("Line down", "danger"),
    force_majeure: T("Force majeure", "danger"),
    quality_rejection: T("Quality rejection", "warn"),
    shortage: T("Shortage", "warn"),
    mrp_exception: T("MRP exception", "accent"),
    volume_change: T("Volume change", "accent"),
  };
  return m[v] ?? T(v, "neutral");
}

export function urgencyBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    critical: T("Critical", "danger"),
    high: T("High", "warn"),
    med: T("Medium", "accent"),
    low: T("Low", "neutral"),
  };
  return m[v] ?? T(v, "neutral");
}

export function spotStatusBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    triage: T("Triage", "neutral"),
    sourcing: T("Sourcing", "accent"),
    quoting: T("Quoting", "accent"),
    requisition: T("Requisition", "accent"),
    approval: T("Awaiting approval", "warn"),
    po: T("PO", "navy"),
    closed: T("Closed", "good"),
    cancelled: T("Cancelled", "neutral"),
  };
  return m[v] ?? T(v, "neutral");
}

export function approvalBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    pending: T("Pending", "warn"),
    approved: T("Approved", "good"),
    rejected: T("Rejected", "danger"),
    escalated: T("Escalated", "accent"),
  };
  return m[v] ?? T(v, "neutral");
}

export function poBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    drafted: T("Drafted", "neutral"),
    released: T("Released", "good"),
    acknowledged: T("Acknowledged", "good"),
    closed: T("Closed", "neutral"),
  };
  return m[v] ?? T(v, "neutral");
}

export function customsBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    not_required: T("Not required", "neutral"),
    assembling: T("Assembling", "warn"),
    ready: T("Ready for broker", "accent"),
    verified: T("Verified", "good"),
    hold: T("Border hold", "danger"),
  };
  return m[v] ?? T(v, "neutral");
}

export function inviteBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    invited: T("Invited", "neutral"),
    followed_up: T("Followed up", "accent"),
    quoted: T("Quoted", "good"),
    declined: T("Declined", "danger"),
    no_reply: T("No reply", "warn"),
  };
  return m[v] ?? T(v, "neutral");
}

export function actorBadge(v: string) {
  const m: Record<string, { label: string; tone: Tone }> = {
    ai: T("Reserve", "accent"),
    human: T("Human", "navy"),
    system: T("System", "neutral"),
  };
  return m[v] ?? T(v, "neutral");
}
