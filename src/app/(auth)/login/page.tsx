import Link from "next/link";
import { redirect } from "next/navigation";

import { NO_ADMIN_MESSAGE } from "@/lib/auth/constants";
import { getAuthState, getCurrentUser } from "@/lib/auth/dal";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  const state = getAuthState();
  // Fresh install with no users yet -> create the first admin.
  if (state === "uninitialized") redirect("/setup");

  // Users exist but no admin: broken, unrecoverable state — block login.
  if (state === "no-admin") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Cannot sign in</h1>
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {NO_ADMIN_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back to Query Optimizer.</p>
      </header>
      <LoginForm />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
