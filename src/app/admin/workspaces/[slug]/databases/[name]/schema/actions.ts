"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { clientIp } from "@/lib/http";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";
import { userLogService } from "@/lib/users";
import { syncManager, type RequestResult } from "@/lib/db-introspect";

/** Queue a background schema sync for a database. Returns the live/queued job. */
export async function startSchemaSync(slug: string, name: string): Promise<RequestResult> {
  const admin = await requireAdmin();
  const ws = workspaceService.getBySlug(slug);
  if (!ws) throw new Error("Workspace not found.");
  const dbRow = databaseService.getByName(ws.id, name);
  if (!dbRow) throw new Error("Database not found.");
  const result = syncManager.requestSync(dbRow.id, { requestedBy: admin.id, trigger: "manual" });
  if (!result.alreadyActive) {
    userLogService.record("schema.sync", {
      actorId: admin.id,
      targetType: "database",
      targetId: dbRow.id,
      workspaceId: ws.id,
      ip: await clientIp(),
      metadata: { name: dbRow.name },
    });
  }
  return result;
}
