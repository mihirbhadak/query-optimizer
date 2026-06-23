import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { introspectionRepository } from "@/lib/db";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";
import { lastSyncInfo, syncManager } from "@/lib/db-introspect";

import { SchemaSyncPanel } from "./SchemaSyncPanel";

export const metadata = { title: "Database · Schema" };

export default async function DatabaseSchemaTab({
  params,
}: {
  params: Promise<{ slug: string; name: string }>;
}) {
  await requireAdmin();
  const { slug, name } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();
  const d = databaseService.getByName(ws.id, name);
  if (!d) notFound();

  const summary = introspectionRepository.getSummary(d.id);

  return (
    <SchemaSyncPanel
      slug={slug}
      name={d.name}
      engine={d.engine}
      initialSummary={summary}
      initialStatus={syncManager.getStatus(d.id)}
      initialLastSync={lastSyncInfo(summary.lastSyncAt)}
      tree={introspectionRepository.getSchemaTree(d.id)}
    />
  );
}
