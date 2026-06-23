import { getCurrentUser, getRoleNames } from "@/lib/auth/dal";
import { introspectionRepository } from "@/lib/db";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";
import { lastSyncInfo, syncManager } from "@/lib/db-introspect";

/** Per-database sync status + stored-schema summary, polled by the Schema tab. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; name: string }> }) {
  const user = await getCurrentUser();
  if (!user || !getRoleNames(user.id).includes("admin")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug, name } = await ctx.params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) return Response.json({ error: "not found" }, { status: 404 });
  const dbRow = databaseService.getByName(ws.id, name);
  if (!dbRow) return Response.json({ error: "not found" }, { status: 404 });

  const summary = introspectionRepository.getSummary(dbRow.id);
  return Response.json({
    status: syncManager.getStatus(dbRow.id),
    summary,
    lastSync: lastSyncInfo(summary.lastSyncAt),
  });
}
