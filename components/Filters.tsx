"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

export interface FilterSelect {
  type: "select";
  name: string;
  label: string;
  options: { value: string; label: string }[];
}
export interface FilterSearch {
  type: "search";
  name: string;
  label: string;
  placeholder?: string;
}
export type FilterField = FilterSelect | FilterSearch;

export function Filters({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (name: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "all") next.delete(name);
      else next.set(name, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      {fields.map((f) => {
        const current = params.get(f.name) || "";
        if (f.type === "search") {
          return (
            <div
              key={f.name}
              className="relative col-span-2 w-full min-w-0 sm:col-auto sm:w-auto sm:min-w-[200px] sm:flex-1"
            >
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                defaultValue={current}
                onChange={(e) => update(f.name, e.target.value)}
                placeholder={f.placeholder || f.label}
                className="field pl-9"
                aria-label={f.label}
              />
            </div>
          );
        }
        return (
          <div key={f.name} className="min-w-0 sm:min-w-[150px] sm:flex-none">
            <label className="label">{f.label}</label>
            <select
              value={current || "all"}
              onChange={(e) => update(f.name, e.target.value)}
              className="field"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
