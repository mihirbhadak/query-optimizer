import { requireAdmin } from "@/lib/auth/dal";
import { userService } from "@/lib/users";
import { workspaceService } from "@/lib/workspaces";

import { WorkspaceUsersTable, type UserRow } from "./WorkspaceUsersTable";

export const metadata = { title: "Workspace · Users" };

export default async function UsersTab({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const ws = workspaceService.getBySlug(slug);
  if (!ws) return null;
  const wsId = ws.id;

  const roleByUser = new Map(workspaceService.members(wsId).map((m) => [m.user_id, m.role]));
  const rows: UserRow[] = userService
    .list()
    .filter((u) => u.status === "active" && u.id !== admin.id) // exclude self
    .map((u) => ({
      id: u.id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role: roleByUser.get(u.id) ?? null,
    }));

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          Authorize users for this workspace and set their role. Select rows to bulk-assign a role.
        </p>
      </div>
      <WorkspaceUsersTable workspaceId={wsId} rows={rows} />
    </div>
  );
}
