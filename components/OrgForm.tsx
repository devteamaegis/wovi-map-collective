import Link from "next/link";
import { createOrgAction, updateOrgAction } from "@/app/actions";
import type { Organization } from "@/lib/types";

export function OrgForm({
  mode,
  org,
}: {
  mode: "create" | "edit";
  org?: Organization;
}) {
  const action = mode === "create" ? createOrgAction : updateOrgAction;
  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && org ? (
        <input type="hidden" name="id" value={org.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input
            name="name"
            required
            defaultValue={org?.name}
            className="field"
            placeholder="Organization name"
          />
        </div>
        <div>
          <label className="label">Kind</label>
          <select name="kind" className="field" defaultValue={org?.kind || "supplier"}>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
            <option value="broker">Broker</option>
            <option value="facility">Facility</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Country</label>
          <input
            name="country"
            defaultValue={org?.country || ""}
            className="field"
            placeholder="e.g. Germany"
          />
        </div>
        <div>
          <label className="label">Region</label>
          <input
            name="region"
            defaultValue={org?.region || ""}
            className="field"
            list="region-options"
            placeholder="e.g. Europe"
          />
          <datalist id="region-options">
            <option value="North America" />
            <option value="Europe" />
            <option value="China" />
            <option value="SE Asia" />
            <option value="LATAM" />
          </datalist>
        </div>
      </div>

      <div>
        <label className="label">Materials / commodity tags</label>
        <input
          name="materials"
          defaultValue={org?.materials.join(", ") || ""}
          className="field"
          placeholder="comma-separated, e.g. lithium, cobalt, nickel"
        />
      </div>
      <div>
        <label className="label">Capability tags</label>
        <input
          name="capabilities"
          defaultValue={org?.capabilities.join(", ") || ""}
          className="field"
          placeholder="comma-separated, e.g. refining, brine extraction"
        />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={org?.notes || ""}
          className="field resize-y"
          placeholder="Context the broker should remember…"
        />
      </div>

      <div className="flex items-center gap-3 border-t border-rule pt-5">
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "Create organization" : "Save changes"}
        </button>
        <Link
          href={mode === "edit" && org ? `/directory/org/${org.id}` : "/directory"}
          className="btn btn-ghost"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
