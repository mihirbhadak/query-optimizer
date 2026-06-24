import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { workspaceService } from "@/lib/workspaces";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { WorkspaceTabs } from "../../(workspace)/WorkspaceTabs";

// The database list/"new" pages live here (not under the (workspace) group) so
// the sibling [name] detail subtree can opt out of the workspace chrome. This
// layout re-supplies that chrome — breadcrumb + workspace tabs — for the list.
export default async function DatabasesBrowseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/workspaces"
            aria-label="Back to workspaces"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="text-border">|</span>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/workspaces">Workspaces</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{ws.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
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
