/**
 * Data Access Layer for auth — the secure (DB-backed) session checks. Use these
 * in Server Components / Server Actions / Route Handlers, not raw cookie reads.
 */

import { cache } from "react";
import { redirect } from "next/navigation";

import { userService, type AuthState, type SafeUser } from "@/lib/users";

import { readSession } from "./session";

export type { SafeUser };

/**
 * The current authenticated user, or null. Memoized per render pass so multiple
 * components can call it without repeated DB hits.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = userService.get(session.uid);
  if (!user || user.status !== "active") return null;
  return user;
});

/** Require a logged-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an admin; redirect non-admins (or guests) away. */
export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (!userService.isAdmin(user.id)) redirect("/");
  return user;
}

/** Role names held by a user. */
export function getRoleNames(userId: number): string[] {
  return userService.roleNames(userId);
}

/** App auth state: uninitialized | no-admin | ready. */
export function getAuthState(): AuthState {
  return userService.authState();
}
