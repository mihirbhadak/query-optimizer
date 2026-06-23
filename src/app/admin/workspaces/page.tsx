import Link from "next/link";
import { Building2 } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";

export const metadata = { title: "Admin · Workspaces" };

export default async function WorkspacesPage() {
  await requireAdmin();
  const workspaces = workspaceService.list();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Each workspace groups databases, users, instructions, and settings.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces yet"
          description="Create your first workspace to group databases, users, instructions, and settings."
          action={<CreateWorkspaceDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const count = workspaceService.memberCount(ws.id);
            return (
              <Link key={ws.id} href={`/admin/workspaces/${ws.slug}`} className="block">
                <Card className="h-full transition hover:border-foreground/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{ws.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {ws.slug}
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p className="line-clamp-2">{ws.description || "No description."}</p>
                    <p className="mt-2 text-xs">
                      {count} member{count === 1 ? "" : "s"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
