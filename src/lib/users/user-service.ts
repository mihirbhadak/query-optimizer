/**
 * UserService — the single entry point for all user operations (create / read /
 * update / delete / list + role management). Holds the business rules; data
 * access goes through repositories, audit entries through UserLogService.
 *
 * Invariant enforced here: there must always be at least one admin. The last
 * admin cannot be deleted, demoted, or deactivated — promote another user first.
 */

import { rolesRepository, userRolesRepository, usersRepository } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { User } from "@/types/db";

import { userLogService } from "./user-log-service";

const ADMIN = "admin";
const MEMBER = "member";

export type UserRole = typeof ADMIN | typeof MEMBER;
export type UserStatus = "pending" | "active" | "rejected" | "deleted";

/** Result of a credential check — distinguishes account-state from invalid. */
export type CredentialResult =
  | { ok: true; user: SafeUser }
  | { ok: false; reason: "invalid" | "pending" | "rejected" | "deleted" };
/** User shape safe to expose — never includes the password hash. */
export type SafeUser = Omit<User, "password">;
/**
 * "uninitialized" = no users yet (run first-time setup).
 * "no-admin"      = users exist but none is an admin (broken — login is blocked).
 * "ready"         = at least one admin exists.
 */
export type AuthState = "uninitialized" | "no-admin" | "ready";

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
}

/** Who is performing the action (for audit logs). */
export interface Actor {
  actorId?: number;
  ip?: string;
}

export class UserServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserServiceError";
  }
}

const toSafe = (u: User): SafeUser => {
  const { password: _password, ...rest } = u;
  return rest;
};

export class UserService {
  // ----------------------------------------------------------------- reads
  get(id: number): SafeUser | undefined {
    const u = usersRepository.getById(id);
    return u ? toSafe(u) : undefined;
  }

  list(): SafeUser[] {
    return usersRepository.list().map(toSafe);
  }

  count(): number {
    return usersRepository.count();
  }

  /** Number of ACTIVE admins (a soft-deleted/rejected admin doesn't count). */
  countAdmins(): number {
    return userRolesRepository.countActiveUsersWithRole(ADMIN);
  }

  roleNames(id: number): string[] {
    return userRolesRepository.rolesForUser(id).map((r) => r.name);
  }

  isAdmin(id: number): boolean {
    return this.roleNames(id).includes(ADMIN);
  }

  authState(): AuthState {
    if (this.count() === 0) return "uninitialized";
    if (this.countAdmins() === 0) return "no-admin";
    return "ready";
  }

  listPending(): SafeUser[] {
    return usersRepository.listByStatus("pending").map(toSafe);
  }

  /**
   * Verify login credentials. Reveals the account state (pending/rejected/deleted)
   * only after the password is correct, so existence isn't leaked to wrong guesses.
   */
  verifyCredentials(identifier: string, password: string): CredentialResult {
    const user = usersRepository.getByEmailOrUsername(identifier);
    if (!user || !verifyPassword(password, user.password)) return { ok: false, reason: "invalid" };
    if (user.status !== "active") return { ok: false, reason: user.status };
    return { ok: true, user: toSafe(user) };
  }

  // ---------------------------------------------------------------- writes
  create(input: CreateUserInput, actor: Actor = {}): SafeUser {
    this.assertUnique(input.username, input.email);
    const user = usersRepository.create({
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: hashPassword(input.password),
      status: input.status,
    });
    const role = input.role ?? MEMBER;
    this.assignRole(user.id, role);
    userLogService.record("user.create", {
      actorId: actor.actorId ?? user.id,
      targetId: user.id,
      ip: actor.ip,
      metadata: { username: user.username, role },
    });
    return toSafe(user);
  }

  update(id: number, patch: UpdateUserInput, actor: Actor = {}): SafeUser {
    const existing = usersRepository.getById(id);
    if (!existing) throw new UserServiceError("User not found.");

    if (patch.username && patch.username !== existing.username && usersRepository.getByUsername(patch.username)) {
      throw new UserServiceError("Username already taken.");
    }
    if (patch.email && patch.email !== existing.email && usersRepository.getByEmail(patch.email)) {
      throw new UserServiceError("Email already registered.");
    }
    if (patch.status && patch.status !== "active") this.assertNotLastAdmin(id, "deactivate");

    const updated = usersRepository.update(id, {
      username: patch.username,
      email: patch.email,
      first_name: patch.firstName,
      last_name: patch.lastName,
      status: patch.status,
      password: patch.password ? hashPassword(patch.password) : undefined,
    });
    userLogService.record("user.update", {
      actorId: actor.actorId,
      targetId: id,
      ip: actor.ip,
      metadata: { fields: Object.keys(patch) },
    });
    return toSafe(updated!);
  }

  /** Soft-delete a user (status becomes "deleted"; the row is kept for audit). */
  delete(id: number, actor: Actor = {}): SafeUser {
    const existing = usersRepository.getById(id);
    if (!existing) throw new UserServiceError("User not found.");
    this.assertNotLastAdmin(id, "delete");
    const updated = usersRepository.update(id, { status: "deleted" });
    userLogService.record("user.delete", {
      actorId: actor.actorId,
      targetId: id,
      ip: actor.ip,
      metadata: { username: existing.username },
    });
    return toSafe(updated!);
  }

  setStatus(id: number, status: UserStatus, actor: Actor = {}): SafeUser {
    return this.update(id, { status }, actor);
  }

  /** Approve a pending user so they can log in. */
  approve(id: number, actor: Actor = {}): SafeUser {
    const user = usersRepository.getById(id);
    if (!user) throw new UserServiceError("User not found.");
    const updated = usersRepository.update(id, { status: "active" });
    userLogService.record("user.approve", { actorId: actor.actorId, targetId: id });
    return toSafe(updated!);
  }

  /** Reject a signup request (soft — status becomes "rejected"). */
  reject(id: number, actor: Actor = {}): SafeUser {
    const user = usersRepository.getById(id);
    if (!user) throw new UserServiceError("User not found.");
    this.assertNotLastAdmin(id, "reject");
    const updated = usersRepository.update(id, { status: "rejected" });
    userLogService.record("user.reject", {
      actorId: actor.actorId,
      targetId: id,
      metadata: { username: user.username },
    });
    return toSafe(updated!);
  }

  promoteToAdmin(id: number, actor: Actor = {}): void {
    if (!usersRepository.getById(id)) throw new UserServiceError("User not found.");
    this.assignRole(id, ADMIN);
    userLogService.record("user.promote_admin", { actorId: actor.actorId, targetId: id, ip: actor.ip });
  }

  demoteFromAdmin(id: number, actor: Actor = {}): void {
    if (!this.isAdmin(id)) return;
    this.assertNotLastAdmin(id, "remove admin from");
    const role = rolesRepository.getByName(ADMIN);
    if (role) userRolesRepository.unassign(id, role.id);
    userLogService.record("user.demote_admin", { actorId: actor.actorId, targetId: id, ip: actor.ip });
  }

  // --------------------------------------------------------------- helpers
  private assertUnique(username: string, email: string): void {
    if (usersRepository.getByUsername(username)) throw new UserServiceError("Username already taken.");
    if (usersRepository.getByEmail(email)) throw new UserServiceError("Email already registered.");
  }

  private assignRole(userId: number, roleName: UserRole): void {
    const role =
      roleName === ADMIN
        ? rolesRepository.getOrCreate({ name: ADMIN, description: "Full access", permissions: { "*": true } })
        : rolesRepository.getOrCreate({ name: MEMBER, description: "Standard user" });
    userRolesRepository.assign(userId, role.id);
  }

  private assertNotLastAdmin(id: number, what: string): void {
    if (this.isAdmin(id) && this.countAdmins() <= 1) {
      throw new UserServiceError(
        `Cannot ${what} the last admin — assign the admin role to another user first.`,
      );
    }
  }
}

export const userService = new UserService();
