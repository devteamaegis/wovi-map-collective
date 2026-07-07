"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Share2,
  ClipboardList,
  ShieldCheck,
  BookUser,
  Compass,
  Zap,
  Stamp,
  Plug,
  BarChart3,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Zap;
  match: (p: string) => boolean;
}

const GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Reserve",
    items: [
      {
        href: "/reserve",
        label: "Spot Buys",
        icon: Zap,
        match: (p) =>
          p === "/reserve" ||
          (p.startsWith("/reserve/") &&
            !p.startsWith("/reserve/approvals") &&
            !p.startsWith("/reserve/integrations")),
      },
      {
        href: "/reserve/approvals",
        label: "Approvals",
        icon: Stamp,
        match: (p) => p.startsWith("/reserve/approvals"),
      },
      {
        href: "/reserve/analytics",
        label: "Analytics",
        icon: BarChart3,
        match: (p) => p.startsWith("/reserve/analytics"),
      },
      {
        href: "/reserve/integrations",
        label: "Integrations",
        icon: Plug,
        match: (p) => p.startsWith("/reserve/integrations"),
      },
    ],
  },
  {
    heading: "Relationship Intelligence",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/" },
      { href: "/graph", label: "Relationship Graph", icon: Share2, match: (p) => p.startsWith("/graph") },
      { href: "/needs", label: "Needs", icon: ClipboardList, match: (p) => p.startsWith("/needs") },
      { href: "/consent", label: "Consent Center", icon: ShieldCheck, match: (p) => p.startsWith("/consent") },
      { href: "/directory", label: "Directory", icon: BookUser, match: (p) => p.startsWith("/directory") },
      { href: "/ask", label: "Ask the Map", icon: Compass, match: (p) => p.startsWith("/ask") },
    ],
  },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.heading} role="group" aria-label={group.heading} className="flex flex-col gap-0.5">
          <span className="mono px-3 pb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
            {group.heading}
          </span>
          {group.items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-accent-2" : "text-white/40 group-hover:text-white/70"}
                />
                <span className="mono text-[12px] tracking-wide uppercase">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
