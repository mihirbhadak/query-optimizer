// DB-free constants/helpers — safe to import from client components.

import type { WorkspaceRole } from "@/types/db";

export const WORKSPACE_ROLES: WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

/** lowercase, alphanumeric + single hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
