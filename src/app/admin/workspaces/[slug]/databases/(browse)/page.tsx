import Link from "next/link";
import { notFound } from "next/navigation";
import { Database, Plus } from "lucide-react";

import { requireAdmin } from "@/lib/auth/dal";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { deleteDatabase } from "./actions";

export const metadata = { title: "Workspace · Databases" };

export default async function DatabasesTab({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();
  const databases = databaseService.list(ws.id);
  const newHref = `/admin/workspaces/${slug}/databases/new`;

  if (databases.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No databases yet"
        description="Connect a database (directly or via SSH tunnel) to this workspace."
        action={
          <Button asChild>
            <Link href={newHref}>
              <Plus className="size-4" />
              Add database
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {databases.length} database{databases.length === 1 ? "" : "s"}
        </p>
        <Button asChild size="sm">
          <Link href={newHref}>
            <Plus className="size-4" />
            Add database
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {databases.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            <Link
              href={`/admin/workspaces/${slug}/databases/${encodeURIComponent(d.name)}`}
              className="block transition-colors hover:bg-muted/40"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    <CardDescription className="truncate font-mono text-xs">
                      {d.username}@{d.host}:{d.port}
                      {d.db_name ? `/${d.db_name}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {d.engine}
                  </Badge>
                </div>
              </CardHeader>
            </Link>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{d.connection_method === "ssh" ? "SSH tunnel" : "Direct"}</Badge>
                {d.ssl_mode !== "disabled" ? <Badge variant="outline">TLS</Badge> : null}
              </div>
              <form action={deleteDatabase}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={d.id} />
                <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                  Delete
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
