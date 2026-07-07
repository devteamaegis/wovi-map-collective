"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";

interface FromOption {
  value: string; // "org:ID" | "person:ID"
  label: string;
  group: "Organizations" | "People";
}

export function AskForm({
  options,
  defaults,
  regions,
}: {
  options: FromOption[];
  defaults: {
    from: string;
    capability: string;
    material: string;
    region: string;
    consentedOnly: boolean;
  };
  regions: string[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(defaults.from);
  const [capability, setCapability] = useState(defaults.capability);
  const [material, setMaterial] = useState(defaults.material);
  const [region, setRegion] = useState(defaults.region);
  const [consentedOnly, setConsentedOnly] = useState(defaults.consentedOnly);

  const orgOpts = options.filter((o) => o.group === "Organizations");
  const personOpts = options.filter((o) => o.group === "People");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [fromType, fromId] = from.split(":");
    const params = new URLSearchParams();
    params.set("fromType", fromType);
    params.set("fromId", fromId);
    if (capability.trim()) params.set("capability", capability.trim());
    if (material.trim()) params.set("material", material.trim());
    if (region) params.set("region", region);
    if (consentedOnly) params.set("consented", "1");
    params.set("run", "1");
    router.push(`/ask?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} data-tour="ask-form" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="ask-from">From</label>
          <select
            id="ask-from"
            className="field"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <optgroup label="Organizations">
              {orgOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="People">
              {personOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ask-region">Target region</label>
          <select
            id="ask-region"
            className="field"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">Any region</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="ask-capability">Capability / requirement</label>
          <input
            id="ask-capability"
            className="field"
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            placeholder="e.g. wafer fab, cold storage, forging"
          />
        </div>
        <div>
          <label className="label" htmlFor="ask-material">Material tag (optional)</label>
          <input
            id="ask-material"
            className="field"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="e.g. lithium, copper, cocoa"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={consentedOnly}
            onChange={(e) => setConsentedOnly(e.target.checked)}
            className="h-4 w-4 accent-[#4a6e92]"
          />
          Consented edges only (double opt-in)
        </label>
        <button type="submit" className="btn btn-primary">
          <Compass size={15} /> Find trusted paths
        </button>
      </div>
    </form>
  );
}
