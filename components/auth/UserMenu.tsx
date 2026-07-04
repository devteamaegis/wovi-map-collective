"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Users, Plug, ChevronDown } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";

export interface SessionUser {
  name: string;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  broker: "Broker",
  buyer: "Buyer",
  approver: "Approver",
  viewer: "Viewer",
};

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-rule bg-white px-2 py-1.5 hover:bg-paper-2"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-navy text-[11px] font-medium text-white">
          {initial}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[12px] font-medium leading-tight text-ink">{user.name}</span>
          <span className="block text-[10px] leading-tight text-ink-3">{ROLE_LABEL[user.role] ?? user.role}</span>
        </span>
        <ChevronDown size={13} className="text-ink-3" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-rule bg-white py-1.5 shadow-panel">
          <div className="border-b border-rule px-3 pb-2 pt-1">
            <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-ink-3">{user.email}</p>
          </div>
          {user.role === "admin" ? (
            <Link href="/reserve/admin/users" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-ink-2 hover:bg-paper-2">
              <Users size={14} className="text-ink-3" /> Users &amp; roles
            </Link>
          ) : null}
          <Link href="/reserve/integrations" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-ink-2 hover:bg-paper-2">
            <Plug size={14} className="text-ink-3" /> Integrations
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-paper-2">
              <LogOut size={14} className="text-ink-3" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
