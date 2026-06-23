"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { slug: "analytics", label: "Analytics" },
  { slug: "users", label: "Users" },
  { slug: "instructions", label: "Instructions" },
  { slug: "security", label: "Security" },
  { slug: "edit", label: "Edit" },
];

export function DatabaseTabs({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname();
  const base = `/admin/workspaces/${slug}/databases/${encodeURIComponent(name)}`;
  return (
    <div className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => {
        const href = `${base}/${t.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
