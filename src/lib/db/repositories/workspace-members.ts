import { db } from "../client";
import type { WorkspaceMember, WorkspaceRole } from "@/types/db";

/** A membership row joined with the basic user fields needed by the UI. */
export interface WorkspaceMemberWithUser {
  id: number;
  workspace_id: number;
  user_id: number;
  role: WorkspaceRole;
  created_at: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
}

export const workspaceMembersRepository = {
  /** Add or update a user's role in a workspace. */
  upsert(workspaceId: number, userId: number, role: WorkspaceRole): WorkspaceMember {
    db.prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = excluded.role, updated_at = CURRENT_TIMESTAMP`,
    ).run(workspaceId, userId, role);
    return db
      .prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, userId) as WorkspaceMember;
  },

  remove(workspaceId: number, userId: number): void {
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").run(
      workspaceId,
      userId,
    );
  },

  listWithUsers(workspaceId: number): WorkspaceMemberWithUser[] {
    return db
      .prepare(
        `SELECT m.id, m.workspace_id, m.user_id, m.role, m.created_at,
                u.username, u.email, u.first_name, u.last_name, u.status
         FROM workspace_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.workspace_id = ?
         ORDER BY u.username`,
      )
      .all(workspaceId) as WorkspaceMemberWithUser[];
  },

  countForWorkspace(workspaceId: number): number {
    return (
      db
        .prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ?")
        .get(workspaceId) as { n: number }
    ).n;
  },
};
