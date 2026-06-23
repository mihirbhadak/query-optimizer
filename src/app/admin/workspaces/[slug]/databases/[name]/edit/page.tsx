import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";

import { DatabaseForm } from "../../../(workspace)/databases/DatabaseForm";

export const metadata = { title: "Database · Edit" };

export default async function DatabaseEditTab({
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

  return <DatabaseForm slug={slug} database={d} />;
}
