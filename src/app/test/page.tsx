import Link from "next/link";
import { notFound } from "next/navigation";

import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const metadata = { title: "Test dashboards" };

const DASHBOARDS = [
  { href: "/test/tunnels", title: "SSH Tunnels", desc: "Manage the in-process SSH tunnel manager." },
  { href: "/test/databases", title: "Databases", desc: "Pooled MySQL runner — connect and run queries." },
];

export default function TestIndexPage() {
  if (!dashboardEnabled()) notFound();
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Test dashboards</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Temporary, unauthenticated admin tools for development only.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DASHBOARDS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{d.title}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{d.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
