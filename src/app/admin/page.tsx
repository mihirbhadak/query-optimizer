import Link from "next/link";

import { requireAdmin } from "@/lib/auth/dal";
import { settingsService } from "@/lib/settings";
import { userService } from "@/lib/users";

import { approveUser, rejectUser, setSignupApproval } from "./actions";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const requiresApproval = settingsService.signupRequiresApproval();
  const pending = userService.listPending();

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Administration</h1>
          <Link href="/" className="text-sm text-zinc-500 underline dark:text-zinc-400">
            ← Home
          </Link>
        </header>

        {/* Signup approval setting */}
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Require admin approval for new signups
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                When on, new accounts are created as <code>pending</code> and cannot log in until an
                admin approves them.
              </p>
            </div>
            <form action={setSignupApproval}>
              <input type="hidden" name="enabled" value={(!requiresApproval).toString()} />
              <button
                type="submit"
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  requiresApproval
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "border border-zinc-300 text-zinc-700 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                {requiresApproval ? "On — click to disable" : "Off — click to enable"}
              </button>
            </form>
          </div>
        </section>

        {/* Pending requests */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Pending signup requests ({pending.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {pending.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No pending requests.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pending.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                        {u.username}
                        {(u.first_name || u.last_name) && (
                          <span className="text-zinc-400">
                            {" "}
                            · {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={approveUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                          Approve
                        </button>
                      </form>
                      <form action={rejectUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">
                          Reject
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
