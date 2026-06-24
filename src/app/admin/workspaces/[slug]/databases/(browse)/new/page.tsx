import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";

import { DatabaseForm } from "../DatabaseForm";

export const metadata = { title: "Workspace · Add database" };

export default async function NewDatabasePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/workspaces/${slug}/databases`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Databases
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Add database</h2>
        <p className="text-sm text-muted-foreground">Connect a database to this workspace.</p>
      </div>
      <DatabaseForm slug={slug} />
    </div>
  );
}
