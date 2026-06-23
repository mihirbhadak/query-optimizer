"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { clientIp } from "@/lib/http";
import { settingsService } from "@/lib/settings";
import { userService, userLogService } from "@/lib/users";

export async function setSignupApproval(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const enabled = formData.get("enabled") === "true";
  settingsService.setSignupRequiresApproval(enabled);
  userLogService.record("settings.signup_approval", {
    actorId: admin.id,
    targetType: "setting",
    ip: await clientIp(),
    metadata: { enabled },
  });
  revalidatePath("/admin/dashboard");
}

export async function approveUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("userId"));
  if (id) userService.approve(id, { actorId: admin.id, ip: await clientIp() });
  revalidatePath("/admin/dashboard");
}

export async function rejectUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("userId"));
  if (id) userService.reject(id, { actorId: admin.id, ip: await clientIp() });
  revalidatePath("/admin/dashboard");
}
