"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService, WorkspaceServiceError } from "@/lib/workspaces";
import type { WorkspaceRole } from "@/types/db";

export type ActionState = { error?: string; notice?: string } | undefined;

function toError(err: unknown): ActionState {
  if (err instanceof WorkspaceServiceError) return { error: err.message };
  return { error: "Something went wrong. Please try again." };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let slug: string;
  try {
    slug = workspaceService.create(
      { name: str(formData, "name"), slug: str(formData, "slug"), description: str(formData, "description") },
      { actorId: admin.id },
    ).slug;
  } catch (err) {
    return toError(err);
  }
  redirect(`/admin/workspaces/${slug}`);
}

export async function updateWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const before = workspaceService.get(id);
  let updated;
  try {
    updated = workspaceService.update(
      id,
      { name: str(formData, "name"), slug: str(formData, "slug"), description: str(formData, "description") },
      { actorId: admin.id },
    );
  } catch (err) {
    return toError(err);
  }
  // Slug changed -> the current URL is stale; navigate to the canonical one.
  if (before && before.slug !== updated.slug) {
    redirect(`/admin/workspaces/${updated.slug}/edit`);
  }
  revalidatePath(`/admin/workspaces/${updated.slug}`, "layout");
  return { notice: "Workspace saved." };
}

export async function deleteWorkspace(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (id) workspaceService.delete(id, { actorId: admin.id });
  redirect("/admin/workspaces");
}

/** Bulk add/update workspace role for the given users. Callable from the client. */
export async function setMembersRole(
  workspaceId: number,
  userIds: number[],
  role: WorkspaceRole,
): Promise<void> {
  const admin = await requireAdmin();
  for (const userId of userIds) {
    // Admins manage other users' access, not their own.
    if (userId && userId !== admin.id) {
      workspaceService.addMember(workspaceId, userId, role, { actorId: admin.id });
    }
  }
  const ws = workspaceService.get(workspaceId);
  if (ws) revalidatePath(`/admin/workspaces/${ws.slug}`, "layout");
}

/** Bulk remove the given users from the workspace. */
export async function removeMembers(workspaceId: number, userIds: number[]): Promise<void> {
  const admin = await requireAdmin();
  for (const userId of userIds) {
    if (userId && userId !== admin.id) {
      workspaceService.removeMember(workspaceId, userId, { actorId: admin.id });
    }
  }
  const ws = workspaceService.get(workspaceId);
  if (ws) revalidatePath(`/admin/workspaces/${ws.slug}`, "layout");
}
