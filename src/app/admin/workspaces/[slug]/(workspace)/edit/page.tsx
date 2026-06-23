import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { workspaceService } from "@/lib/workspaces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DeleteWorkspaceDialog } from "../../../DeleteWorkspaceDialog";
import { WorkspaceSettingsForm } from "../../../WorkspaceSettingsForm";

export const metadata = { title: "Workspace · Edit" };

export default async function EditTab({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>Name, slug and description.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceSettingsForm workspace={ws} />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Delete this workspace and all of its data.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkspaceDialog id={ws.id} name={ws.name} />
        </CardContent>
      </Card>
    </div>
  );
}
