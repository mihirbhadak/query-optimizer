import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/dal";
import SetupForm from "./SetupForm";

export const metadata = { title: "First-run setup" };

// First-run onboarding: only reachable while there are no users at all.
export default async function SetupPage() {
  if (getAuthState() !== "uninitialized") redirect("/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Welcome 👋</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No admin exists yet. Create the first administrator account to get started.
        </p>
      </header>
      <SetupForm />
    </div>
  );
}
