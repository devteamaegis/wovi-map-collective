"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Badge, type Tone } from "@/components/Badge";
import {
  createUserAction,
  setRoleAction,
  setActiveAction,
  linkPersonAction,
} from "@/app/auth/actions";

const ROLES = ["admin", "broker", "buyer", "approver", "viewer"] as const;
type Role = (typeof ROLES)[number];
const ROLE_TONE: Record<Role, Tone> = {
  admin: "navy",
  broker: "broker",
  buyer: "buyer",
  approver: "accent",
  viewer: "neutral",
};

interface Row {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: number;
  person_id: number | null;
  person_name: string | null;
  last_login_at: string | null;
}
interface PersonOpt {
  id: number;
  name: string;
}

export function UsersPanel({
  users,
  people,
  currentUserId,
}: {
  users: Row[];
  people: PersonOpt[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card className="px-5 py-4">
        <Eyebrow>Team ({users.length})</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Roles gate what each person can do. <strong>Segregation of duties</strong> is
          enforced: whoever submits a requisition cannot approve it, regardless of role.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Directory person</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-rule/60">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-[11px] text-ink-3">{u.email}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={u.role}
                      disabled={pending || u.id === currentUserId}
                      onChange={(e) => run(() => setRoleAction(u.id, e.target.value as Role))}
                      className="field py-1 text-[13px]"
                      aria-label={`Role for ${u.name}`}
                      title={u.id === currentUserId ? "You cannot change your own role" : undefined}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={u.person_id ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        run(() => linkPersonAction(u.id, e.target.value ? Number(e.target.value) : null))
                      }
                      className="field py-1 text-[13px]"
                      aria-label={`Directory person for ${u.name}`}
                    >
                      <option value="">— none —</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    {u.id === currentUserId ? (
                      <Badge tone={ROLE_TONE[u.role]}>you</Badge>
                    ) : (
                      <button
                        onClick={() => run(() => setActiveAction(u.id, !u.active))}
                        disabled={pending}
                        className="btn btn-ghost btn-sm"
                      >
                        {u.active ? "Active" : "Disabled"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="px-5 py-4">
        <div className="flex items-center gap-2">
          <UserPlus size={15} className="text-ink-3" />
          <Eyebrow>Invite a teammate</Eyebrow>
        </div>
        <form
          action={(fd) => run(() => createUserAction(fd))}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6"
        >
          <input name="name" required aria-label="New user name" placeholder="Name" className="field sm:col-span-2" />
          <input name="email" required type="email" aria-label="New user email" placeholder="Email" className="field sm:col-span-2" />
          <input name="password" type="password" aria-label="Temporary password" placeholder="Temp password" className="field sm:col-span-1" />
          <select name="role" defaultValue="buyer" aria-label="New user role" className="field sm:col-span-1">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select name="person_id" defaultValue="" aria-label="Link directory person" className="field sm:col-span-2">
            <option value="">Link directory person (optional)…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="btn btn-primary sm:col-span-2">
            Create user
          </button>
        </form>
        <p className="mt-2 text-[12px] text-ink-3">
          Linking a directory person attributes that user&apos;s actions (RFQs, approvals) to a real
          contact in the graph.
        </p>
      </Card>
    </div>
  );
}
