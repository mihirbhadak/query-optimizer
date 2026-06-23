"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { databaseService, DatabaseServiceError, type ConnectionConfig, type TestResult } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";

export type ActionState = { error?: string } | undefined;

function toError(err: unknown): ActionState {
  if (err instanceof DatabaseServiceError) return { error: err.message };
  return { error: "Something went wrong. Please try again." };
}

export async function createDatabase(slug: string, input: ConnectionConfig): Promise<ActionState> {
  const admin = await requireAdmin();
  const ws = workspaceService.getBySlug(slug);
  if (!ws) return { error: "Workspace not found." };
  try {
    databaseService.create({ workspaceId: ws.id, ...input }, { actorId: admin.id });
  } catch (err) {
    return toError(err);
  }
  redirect(`/admin/workspaces/${slug}/databases`);
}

export async function updateDatabase(
  slug: string,
  id: number,
  input: ConnectionConfig,
): Promise<ActionState> {
  const admin = await requireAdmin();
  let updated;
  try {
    updated = databaseService.update(id, input, { actorId: admin.id });
  } catch (err) {
    return toError(err);
  }
  redirect(`/admin/workspaces/${slug}/databases/${encodeURIComponent(updated.name)}/analytics`);
}

export async function testTunnel(input: ConnectionConfig): Promise<TestResult> {
  await requireAdmin();
  return databaseService.testTunnel(input);
}

export async function testConnection(input: ConnectionConfig): Promise<TestResult> {
  await requireAdmin();
  return databaseService.testConnection(input);
}

export async function deleteDatabase(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const id = Number(formData.get("id"));
  if (id) databaseService.delete(id, { actorId: admin.id });
  revalidatePath(`/admin/workspaces/${slug}/databases`);
}
