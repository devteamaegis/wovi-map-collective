"use client";

import { useState } from "react";
import Link from "next/link";
import { createSpotBuyAction } from "@/app/reserve/actions";

interface OrgOpt {
  id: number;
  name: string;
  kind: string;
}
interface PersonOpt {
  id: number;
  name: string;
  org_id: number | null;
  title: string | null;
}

export function NewSpotBuyForm({
  orgs,
  people,
}: {
  orgs: OrgOpt[];
  people: PersonOpt[];
}) {
  const [orgId, setOrgId] = useState("");
  const [crossBorder, setCrossBorder] = useState(false);

  const buyerOrgs = orgs.filter((o) => o.kind === "buyer");
  const relevantPeople = orgId
    ? people.filter((p) => String(p.org_id) === orgId)
    : people;

  return (
    <form action={createSpotBuyAction} className="space-y-5">
      <div>
        <label className="label">What's needed</label>
        <input
          name="title"
          required
          className="field"
          placeholder="e.g. Hot-rolled steel coil — stamping line down"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Trigger</label>
          <select name="trigger" className="field" defaultValue="shortage">
            <option value="line_down">Line down</option>
            <option value="quality_rejection">Quality rejection</option>
            <option value="shortage">Shortage</option>
            <option value="mrp_exception">MRP exception</option>
            <option value="volume_change">Volume change</option>
            <option value="force_majeure">Force majeure</option>
          </select>
        </div>
        <div>
          <label className="label">Urgency</label>
          <select name="urgency" className="field" defaultValue="high">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="med">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Material description</label>
          <input
            name="material_desc"
            className="field"
            placeholder="e.g. Hot-rolled steel coil, 3.0mm × 1250mm"
          />
        </div>
        <div>
          <label className="label">Material number</label>
          <input name="material_number" className="field" placeholder="e.g. STL-HR-3.0-1250" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Quantity</label>
          <input name="quantity" type="number" step="any" className="field" placeholder="60000" />
        </div>
        <div>
          <label className="label">UoM</label>
          <input name="uom" className="field" placeholder="kg" />
        </div>
        <div className="col-span-2">
          <label className="label">Need-by date</label>
          <input name="required_by" type="date" className="field" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Cost center</label>
          <input name="cost_center" className="field" placeholder="CC-4021" />
        </div>
        <div>
          <label className="label">Plant</label>
          <input name="plant" className="field" placeholder="Voltaic Leipzig — Body Shop" />
        </div>
        <div>
          <label className="label">Downtime cost / hour ($)</label>
          <input
            name="downtime_cost_per_hour"
            type="number"
            step="any"
            className="field"
            placeholder="2300000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Buyer organization</label>
          <select
            name="buyer_org_id"
            className="field"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">Select buyer…</option>
            {buyerOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Requesting buyer</label>
          <select name="buyer_person_id" className="field" defaultValue="">
            <option value="">Select person…</option>
            {relevantPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` · ${p.title}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cross-border / customs */}
      <div className="rounded-xl border border-rule bg-paper-2/50 px-4 py-3.5">
        <label className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <input
            type="checkbox"
            name="cross_border"
            checked={crossBorder}
            onChange={(e) => setCrossBorder(e.target.checked)}
            className="h-4 w-4 accent-[#4a6e92]"
          />
          Cross-border shipment (triggers customs packet)
        </label>
        {crossBorder ? (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Metal (Section 232)</label>
              <select name="metal" className="field" defaultValue="steel">
                <option value="steel">Steel</option>
                <option value="aluminum">Aluminum</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="label">Ship from</label>
              <input name="ship_from_country" className="field" placeholder="Turkey" />
            </div>
            <div>
              <label className="label">Ship to</label>
              <input name="ship_to_country" className="field" placeholder="Germany" />
            </div>
            <div>
              <label className="label">Incoterm</label>
              <input name="incoterm" className="field" placeholder="DAP" />
            </div>
          </div>
        ) : (
          <input type="hidden" name="metal" value="none" />
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-rule pt-5">
        <button type="submit" className="btn btn-primary">
          Log spot buy — start the clock
        </button>
        <Link href="/reserve" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
