import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Workspace · Analytics" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function AnalyticsTab({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) return null;
  const memberCount = workspaceService.memberCount(ws.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
        <CardDescription>Workspace details. Analytics charts coming soon.</CardDescription>
      </CardHeader>
      <CardContent>
        <Row label="Name" value={ws.name} />
        <Row label="Slug" value={ws.slug} />
        <Row label="Description" value={ws.description || "—"} />
        <Row label="Members" value={String(memberCount)} />
        <Row label="Created" value={ws.created_at} />
      </CardContent>
    </Card>
  );
}
