import Link from "next/link";

const LINKS = [
  { href: "/test/databases", title: "Databases", desc: "Pooled MySQL runner — connect (direct or via SSH) and run queries." },
  { href: "/test/tunnels", title: "SSH Tunnels", desc: "Manage the in-process SSH tunnel manager." },
];

export default function Home() {
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Query Optimizer</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Internal tools. Temporary admin dashboards live under{" "}
            <Link href="/test" className="underline">
              /test
            </Link>
            .
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LINKS.map((l) => (
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
