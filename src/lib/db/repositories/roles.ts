import { db } from "../client";
import type { Role, User, UserRole } from "@/types/db";

type Perms = Record<string, unknown>;

/** Role definitions (name + permissions set). */
export const rolesRepository = {
  create(input: { name: string; description?: string; permissions?: Perms }): Role {
    const info = db
      .prepare("INSERT INTO roles (name, description, permissions) VALUES (@name, @description, @permissions)")
      .run({
        name: input.name,
        description: input.description ?? null,
        permissions: input.permissions ? JSON.stringify(input.permissions) : null,
      });
    return this.getById(Number(info.lastInsertRowid))!;
  },

  getById(id: number): Role | undefined {
    return db.prepare("SELECT * FROM roles WHERE id = ?").get(id) as Role | undefined;
  },

  getByName(name: string): Role | undefined {
    return db.prepare("SELECT * FROM roles WHERE name = ?").get(name) as Role | undefined;
  },

  /** Get the role by name, creating it if absent. */
  getOrCreate(input: { name: string; description?: string; permissions?: Perms }): Role {
    return this.getByName(input.name) ?? this.create(input);
  },

  list(): Role[] {
    return db.prepare("SELECT * FROM roles ORDER BY name").all() as Role[];
  },
};

/** Assignment of roles to users (with optional per-assignment overrides). */
export const userRolesRepository = {
  assign(userId: number, roleId: number, customPermissions?: Perms): UserRole {
    db.prepare(
      `INSERT INTO user_roles (user_id, role_id, custom_permissions)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, role_id) DO UPDATE SET custom_permissions = excluded.custom_permissions`,
    ).run(userId, roleId, customPermissions ? JSON.stringify(customPermissions) : null);
    return db
      .prepare("SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?")
      .get(userId, roleId) as UserRole;
  },

  unassign(userId: number, roleId: number): void {
    db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?").run(userId, roleId);
  },

  /** All roles assigned to a user. */
  rolesForUser(userId: number): Role[] {
    return db
      .prepare(
        `SELECT r.* FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = ? ORDER BY r.name`,
      )
      .all(userId) as Role[];
  },

  /** All users holding a role. */
  usersForRole(roleId: number): User[] {
    return db
      .prepare(
        `SELECT u.* FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role_id = ? ORDER BY u.username`,
      )
      .all(roleId) as User[];
  },

  /**
   * How many distinct ACTIVE users hold a role by name. Active-only so a
   * soft-deleted/rejected/pending admin doesn't count toward the "must keep one
   * admin" invariant or the admin-bootstrap check.
   */
  countActiveUsersWithRole(roleName: string): number {
    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT ur.user_id) AS n FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN users u ON u.id = ur.user_id
         WHERE r.name = ? AND u.status = 'active'`,
      )
      .get(roleName) as { n: number };
    return row.n;
  },
};
