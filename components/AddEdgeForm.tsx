"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEdgeAction } from "@/app/actions";
import type { NodeType, EdgeKind, ConsentStatus } from "@/lib/types";

export interface NodeOption {
  key: string;
  type: NodeType;
  id: number;
  label: string;
}

const EDGE_KINDS: { value: EdgeKind; label: string }[] = [
  { value: "knows", label: "knows" },
  { value: "introduced_by", label: "introduced by" },
  { value: "brokered_intro", label: "brokered intro" },
  { value: "sources_from", label: "sources from" },
  { value: "supplies", label: "supplies" },
];

const CONSENTS: { value: ConsentStatus; label: string }[] = [
  { value: "none", label: "No consent" },
  { value: "one_sided", label: "One-sided" },
  { value: "double_opt_in", label: "Double opt-in" },
];

export function AddEdgeForm({
  sourceType,
  sourceId,
  options,
  onDone,
}: {
  sourceType: NodeType;
  sourceId: number;
  options: NodeOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [targetKey, setTargetKey] = useState("");
  const [kind, setKind] = useState<EdgeKind>("knows");
  const [consent, setConsent] = useState<ConsentStatus>("none");
  const [provenance, setProvenance] = useState("");
  const [saving, setSaving] = useState(false);

  const targets = options.filter(
    (o) => !(o.type === sourceType && o.id === sourceId)
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetKey) return;
    const target = targets.find((t) => t.key === targetKey);
    if (!target) return;
    setSaving(true);
    await createEdgeAction({
      source_type: sourceType,
      source_id: sourceId,
      target_type: target.type,
      target_id: target.id,
      kind,
      consent_status: consent,
      provenance: provenance.trim() || "Added by broker",
      evidence_note: null,
    });
    setSaving(false);
    setTargetKey("");
    setProvenance("");
    onDone?.();
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="ae-target">Connect to</label>
        <select
          id="ae-target"
          className="field"
          value={targetKey}
          onChange={(e) => setTargetKey(e.target.value)}
          required
        >
          <option value="">Select a node…</option>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} {t.type === "person" ? "(person)" : "(org)"}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ae-kind">Relationship</label>
          <select
            id="ae-kind"
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as EdgeKind)}
          >
            {EDGE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ae-consent">Consent</label>
          <select
            id="ae-consent"
            className="field"
            value={consent}
            onChange={(e) => setConsent(e.target.value as ConsentStatus)}
          >
            {CONSENTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ae-provenance">Provenance</label>
        <input
          id="ae-provenance"
          className="field"
          value={provenance}
          onChange={(e) => setProvenance(e.target.value)}
          placeholder="How do you know this? e.g. 'Met at trade show 2026'"
        />
      </div>
      <button className="btn btn-primary w-full" disabled={saving || !targetKey}>
        {saving ? "Adding…" : "Add edge to graph"}
      </button>
    </form>
  );
}
