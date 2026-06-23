import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { databaseService } from "@/lib/databases";
import { workspaceService } from "@/lib/workspaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Database · Analytics" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function DatabaseAnalyticsTab({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
        <CardDescription>Connection details. Analytics charts coming soon.</CardDescription>
      </CardHeader>
      <CardContent>
        <Row label="Name" value={d.name} />
        <Row label="Engine" value={d.engine} />
        <Row label="Host" value={`${d.host}:${d.port}`} />
        <Row label="User" value={d.username} />
        <Row label="Password set" value={d.has_password ? "Yes" : "No"} />
        <Row label="Default database" value={d.db_name || "—"} />
        <Row label="TLS / SSL" value={d.ssl_mode} />
        <Row label="Connection" value={d.connection_method === "ssh" ? "SSH tunnel" : "Direct"} />
        {d.connection_method === "ssh" ? (
          <>
            <Row label="SSH host" value={`${d.ssh_username ?? ""}@${d.ssh_host ?? ""}:${d.ssh_port ?? 22}`} />
            <Row label="SSH auth" value={d.ssh_auth_method === "privateKey" ? "Private key" : "Password"} />
          </>
        ) : null}
        <Row label="Created" value={d.created_at} />
      </CardContent>
    </Card>
  );
}
