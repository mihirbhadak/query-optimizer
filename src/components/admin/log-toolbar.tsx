"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectFilter {
  name: string;
  placeholder: string;
  value: string;
  /** The value used for the "all / no filter" option. */
  allValue: string;
  options: { value: string; label: string }[];
}

/**
 * Filter bar for the log viewers. Reads current values from props (the server
 * page derives them from the URL) and pushes changes back into the query string,
 * so filtering/paging is shareable and works without client state on the server.
 */
export function LogToolbar({
  basePath,
  search,
  from,
  to,
  selects,
}: {
  basePath: string;
  search: string;
  from: string;
  to: string;
  selects: SelectFilter[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(search);

  // Build a URL from the current filters, with overrides; always resets paging.
  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const current: Record<string, string> = { search: q, from, to };
    for (const s of selects) current[s.name] = s.value === s.allValue ? "" : s.value;
    const merged = { ...current, ...overrides };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return sp.toString() ? `${basePath}?${sp}` : basePath;
  };
  const go = (overrides: Record<string, string | undefined>) => router.push(hrefFor(overrides));

  // Debounce free-text search.
  useEffect(() => {
    if (q === search) return;
    const t = setTimeout(() => go({ search: q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Boolean(q || from || to || selects.some((s) => s.value !== s.allValue));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="pl-8 pr-8"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selects.map((s) => (
          <Select key={s.name} value={s.value} onValueChange={(v) => go({ [s.name]: v === s.allValue ? "" : v })}>
            <SelectTrigger size="sm" className="min-w-0 flex-1 sm:flex-none sm:w-[160px]">
              <SelectValue placeholder={s.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={s.allValue}>{s.placeholder}</SelectItem>
              {s.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        <Input
          type="date"
          value={from}
          aria-label="From date"
          onChange={(e) => go({ from: e.target.value })}
          className="h-8 min-w-0 flex-1 sm:flex-none sm:w-[150px]"
        />
        <Input
          type="date"
          value={to}
          aria-label="To date"
          onChange={(e) => go({ to: e.target.value })}
          className="h-8 min-w-0 flex-1 sm:flex-none sm:w-[150px]"
        />

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(basePath)} className="ml-auto">
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
