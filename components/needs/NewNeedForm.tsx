"use client";

import { useState } from "react";
import Link from "next/link";
import { createNeedAction } from "@/app/actions";

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

export function NewNeedForm({
  orgs,
  people,
}: {
  orgs: OrgOpt[];
  people: PersonOpt[];
}) {
  const [orgId, setOrgId] = useState<string>("");

  const buyerOrgs = orgs.filter((o) => o.kind === "buyer");
  const otherOrgs = orgs.filter((o) => o.kind !== "buyer");
  const relevantPeople = orgId
    ? people.filter((p) => String(p.org_id) === orgId)
    : people;

  return (
    <form action={createNeedAction} className="space-y-5">
      <div>
        <label className="label">Title</label>
        <input
          name="title"
          required
          className="field"
          placeholder="e.g. Battery-grade lithium carbonate supplier for EU cell line"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Kind</label>
          <select name="kind" className="field" defaultValue="supplier">
            <option value="supplier">Supplier</option>
            <option value="facility">Facility</option>
            <option value="part">Part</option>
            <option value="material">Material</option>
            <option value="lane">Lane</option>
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="field" defaultValue="med">
            <option value="high">High</option>
            <option value="med">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          name="description"
          rows={3}
          className="field resize-y"
          placeholder="State the requirement plainly — volumes, specs, origin, traceability…"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Material / capability tag</label>
          <input
            name="material_tag"
            className="field"
            placeholder="e.g. lithium, titanium, PCBA, connector, cocoa"
          />
        </div>
        <div>
          <label className="label">Target region</label>
          <select name="target_region" className="field" defaultValue="">
            <option value="">Any region</option>
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
            <option value="China">China</option>
            <option value="SE Asia">SE Asia</option>
            <option value="LATAM">LATAM</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Requester organization</label>
          <select
            name="requester_org_id"
            className="field"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">Select organization…</option>
            {buyerOrgs.length > 0 ? (
              <optgroup label="Buyers">
                {buyerOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Other">
              {otherOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.kind})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="label">Requester person</label>
          <select name="requester_person_id" className="field" defaultValue="">
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

      <div className="flex items-center gap-3 border-t border-rule pt-5">
        <button type="submit" className="btn btn-primary">
          Create need
        </button>
        <Link href="/needs" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
