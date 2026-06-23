import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { databaseService } from "@/lib/databases";
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

import { DatabaseTabs } from "./DatabaseTabs";

export default async function DatabaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; name: string }>;
}) {
  await requireAdmin();
  const { slug, name } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();
  const database = databaseService.getByName(ws.id, name);
  if (!database) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/workspaces/${slug}/databases`}
            aria-label="Back to databases"
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
                <BreadcrumbLink asChild>
                  <Link href={`/admin/workspaces/${slug}`}>{ws.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{database.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{database.name}</h2>
          <Badge variant="secondary" className="capitalize">
            {database.engine}
          </Badge>
          <Badge variant="outline">
            {database.connection_method === "ssh" ? "SSH tunnel" : "Direct"}
          </Badge>
        </div>
      </div>
      <DatabaseTabs slug={slug} name={database.name} />
      {children}
    </div>
  );
}
