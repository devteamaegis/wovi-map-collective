import Link from "next/link";
import { createPersonAction, updatePersonAction } from "@/app/actions";
import type { Person } from "@/lib/types";

export function PersonForm({
  mode,
  person,
  orgs,
}: {
  mode: "create" | "edit";
  person?: Person;
  orgs: { id: number; name: string }[];
}) {
  const action = mode === "create" ? createPersonAction : updatePersonAction;
  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && person ? (
        <input type="hidden" name="id" value={person.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input
            name="name"
            required
            defaultValue={person?.name}
            className="field"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="label">Title</label>
          <input
            name="title"
            defaultValue={person?.title || ""}
            className="field"
            placeholder="e.g. Commercial Director"
          />
        </div>
      </div>

      <div>
        <label className="label">Organization</label>
        <select
          name="org_id"
          className="field"
          defaultValue={person?.org_id != null ? String(person.org_id) : ""}
        >
          <option value="">Unaffiliated</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">WhatsApp</label>
          <input
            name="whatsapp"
            defaultValue={person?.whatsapp || ""}
            className="field"
            placeholder="+1 …"
          />
        </div>
        <div>
          <label className="label">WeChat</label>
          <input
            name="wechat"
            defaultValue={person?.wechat || ""}
            className="field"
            placeholder="wechat id"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            name="phone"
            defaultValue={person?.phone || ""}
            className="field"
            placeholder="+1 …"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={person?.email || ""}
            className="field"
            placeholder="name@company.com"
          />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={person?.notes || ""}
          className="field resize-y"
          placeholder="Relationship context, decision-making role…"
        />
      </div>

      <div className="flex items-center gap-3 border-t border-rule pt-5">
        <button type="submit" className="btn btn-primary">
          {mode === "create" ? "Create person" : "Save changes"}
        </button>
        <Link
          href={
            mode === "edit" && person
              ? `/directory/person/${person.id}`
              : "/directory"
          }
          className="btn btn-ghost"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
