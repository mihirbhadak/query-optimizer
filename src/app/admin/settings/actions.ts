"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { clientIp } from "@/lib/http";
import { logRetentionService, type LogType } from "@/lib/logs";
import { userLogService } from "@/lib/users";

const SETTINGS_PATH = "/admin/settings";

export async function saveLogRetention(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userDays = Math.max(0, Number(formData.get("userDays")) || 0);
  const systemDays = Math.max(0, Number(formData.get("systemDays")) || 0);
  const autoEnabled = formData.get("autoEnabled") === "on";

  logRetentionService.setConfig({ userDays, systemDays, autoEnabled });
  userLogService.record("settings.log_retention", {
    actorId: admin.id,
    targetType: "setting",
    ip: await clientIp(),
    metadata: { userDays, systemDays, autoEnabled },
  });
  revalidatePath(SETTINGS_PATH);
}

export async function runLogCleanup(): Promise<void> {
  const admin = await requireAdmin();
  const result = logRetentionService.prune();
  userLogService.record("logs.cleanup", {
    actorId: admin.id,
    ip: await clientIp(),
    metadata: { ...result },
  });
  revalidatePath(SETTINGS_PATH);
}

export async function clearLogs(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const type = String(formData.get("type") ?? "") as LogType;
  if (type !== "user" && type !== "system" && type !== "all") return;

  const result = logRetentionService.clear(type);
  userLogService.record("logs.clear", {
    actorId: admin.id,
    ip: await clientIp(),
    metadata: { type, ...result },
  });
  revalidatePath(SETTINGS_PATH);
}
