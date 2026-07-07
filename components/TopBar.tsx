"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  User,
  ClipboardList,
  Plus,
  Compass,
} from "lucide-react";
import Link from "next/link";
import { MobileMenu } from "./MobileMenu";
import { UserMenu, type SessionUser } from "./auth/UserMenu";

interface SearchResult {
  type: "org" | "person" | "need";
  id: number;
  label: string;
  sublabel: string;
  href: string;
}

const ICON = { org: Building2, person: User, need: ClipboardList };

export function TopBar({ user }: { user?: SessionUser | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as SearchResult[];
        setResults(data);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted */
      }
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-rule bg-[#fbfcfd]/85 px-3 backdrop-blur sm:gap-4 sm:px-6">
      <MobileMenu />
      <div className="relative min-w-0 max-w-md flex-1" ref={boxRef}>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search orgs, people, needs…"
          aria-label="Search orgs, people, and needs"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[active] ? `search-opt-${results[active].type}-${results[active].id}` : undefined
          }
          className="w-full rounded-lg border border-rule bg-white py-2 pl-9 pr-3 text-sm focus:border-accent-2 focus:outline-none focus:ring-2 focus:ring-[#4a6e92]/40"
        />
        {open && results.length > 0 ? (
          <div id="search-listbox" role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-11 z-40 max-h-96 overflow-auto rounded-xl border border-rule bg-white py-1.5 shadow-panel">
            {results.map((r, i) => {
              const Icon = ICON[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  id={`search-opt-${r.type}-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                    i === active ? "bg-paper-2" : ""
                  }`}
                >
                  <Icon size={15} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {r.label}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {r.sublabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {open && q.trim() && results.length === 0 ? (
          <div role="status" className="absolute left-0 right-0 top-11 z-40 rounded-xl border border-rule bg-white px-3 py-3 text-sm text-ink-3 shadow-panel">
            No matches for “{q}”.
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link href="/ask" className="btn btn-sm" aria-label="Ask the Map">
          <Compass size={14} />
          <span className="hidden sm:inline">Ask the Map</span>
        </Link>
        <Link
          href="/needs/new"
          className="btn btn-primary btn-sm"
          aria-label="New need"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New need</span>
        </Link>
        {user ? <UserMenu user={user} /> : null}
      </div>
    </header>
  );
}
