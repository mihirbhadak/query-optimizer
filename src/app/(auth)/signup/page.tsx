import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthState, getCurrentUser } from "@/lib/auth/dal";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  const state = getAuthState();
  if (state === "uninitialized") redirect("/setup");
  // No admin -> /login surfaces the broken-state message.
  if (state === "no-admin") redirect("/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Create your account</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Join this Query Optimizer workspace.</p>
      </header>
      <SignupForm />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
