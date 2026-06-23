import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";
import { Badge } from "@/components/ui/badge";

import { WorkspaceTabs } from "./WorkspaceTabs";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/admin/workspaces"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Workspaces
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ws.name}</h1>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {ws.slug}
          </Badge>
        </div>
      </div>
      <WorkspaceTabs slug={ws.slug} />
      {children}
    </div>
  );
}
