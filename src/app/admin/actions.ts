"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { settingsService } from "@/lib/settings";
import { userService } from "@/lib/users";

export async function setSignupApproval(formData: FormData): Promise<void> {
  await requireAdmin();
  settingsService.setSignupRequiresApproval(formData.get("enabled") === "true");
  revalidatePath("/admin/dashboard");
}

export async function approveUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("userId"));
  if (id) userService.approve(id, { actorId: admin.id });
  revalidatePath("/admin/dashboard");
}

export async function rejectUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("userId"));
  if (id) userService.reject(id, { actorId: admin.id });
  revalidatePath("/admin/dashboard");
}
