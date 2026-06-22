import Link from "next/link";

import { logoutAction } from "@/lib/auth/actions";
import { getRoleNames, requireUser } from "@/lib/auth/dal";

export default async function Home() {
  const user = await requireUser();
  const roles = getRoleNames(user.id);

  const links = [
    ...(roles.includes("admin")
      ? [{ href: "/admin", title: "Administration", desc: "Manage users and signup approval settings." }]
      : []),
    { href: "/test/databases", title: "Databases", desc: "Pooled MySQL runner — connect (direct or via SSH) and run queries." },
    { href: "/test/tunnels", title: "SSH Tunnels", desc: "Manage the in-process SSH tunnel manager." },
  ];

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Query Optimizer</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as <span className="font-medium">{user.username}</span>
              {roles.length > 0 && <span className="text-zinc-400"> · {roles.join(", ")}</span>}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{l.title}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{l.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
