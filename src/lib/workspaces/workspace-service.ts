/**
 * WorkspaceService — business logic for workspaces and their per-workspace user
 * authorization. Data access via repositories; audit entries via UserLogService.
 */

import {
  workspaceMembersRepository,
  workspacesRepository,
  type WorkspaceMemberWithUser,
} from "@/lib/db";
import { userLogService } from "@/lib/users";
import type { Workspace, WorkspaceRole } from "@/types/db";

import { slugify, WORKSPACE_ROLES } from "./constants";

export interface WorkspaceInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface Actor {
  actorId?: number;
  ip?: string;
}

export class WorkspaceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

export class WorkspaceService {
  list(): Workspace[] {
    return workspacesRepository.list();
  }

  get(id: number): Workspace | undefined {
    return workspacesRepository.getById(id);
  }

  getBySlug(slug: string): Workspace | undefined {
    return workspacesRepository.getBySlug(slug);
  }

  memberCount(workspaceId: number): number {
    return workspaceMembersRepository.countForWorkspace(workspaceId);
  }

  create(input: WorkspaceInput, actor: Actor = {}): Workspace {
    const name = input.name?.trim();
    if (!name) throw new WorkspaceServiceError("Name is required.");
    const slug = this.normalizeSlug(input.slug || name);
    if (workspacesRepository.getBySlug(slug)) {
      throw new WorkspaceServiceError(`Slug "${slug}" is already in use.`);
    }
    const ws = workspacesRepository.create({ name, slug, description: input.description?.trim() });
    userLogService.record("workspace.create", {
      actorId: actor.actorId,
      metadata: { workspaceId: ws.id, name, slug },
    });
    return ws;
  }

  update(id: number, input: WorkspaceInput, actor: Actor = {}): Workspace {
    const existing = workspacesRepository.getById(id);
    if (!existing) throw new WorkspaceServiceError("Workspace not found.");
    const name = input.name?.trim();
    if (!name) throw new WorkspaceServiceError("Name is required.");
    const slug = this.normalizeSlug(input.slug || name);
    const clash = workspacesRepository.getBySlug(slug);
    if (clash && clash.id !== id) {
      throw new WorkspaceServiceError(`Slug "${slug}" is already in use.`);
    }
    const ws = workspacesRepository.update(id, {
      name,
      slug,
      description: input.description?.trim() ?? null,
    })!;
    userLogService.record("workspace.update", {
      actorId: actor.actorId,
      metadata: { workspaceId: id },
    });
    return ws;
  }

  delete(id: number, actor: Actor = {}): void {
    const existing = workspacesRepository.getById(id);
    if (!existing) throw new WorkspaceServiceError("Workspace not found.");
    workspacesRepository.delete(id);
    userLogService.record("workspace.delete", {
      actorId: actor.actorId,
      metadata: { workspaceId: id, name: existing.name },
    });
  }

  // ---- members (per-workspace authorization) ----
  members(workspaceId: number): WorkspaceMemberWithUser[] {
    return workspaceMembersRepository.listWithUsers(workspaceId);
  }

  addMember(workspaceId: number, userId: number, role: WorkspaceRole, actor: Actor = {}): void {
    if (!workspacesRepository.getById(workspaceId)) {
      throw new WorkspaceServiceError("Workspace not found.");
    }
    workspaceMembersRepository.upsert(workspaceId, userId, this.normalizeRole(role));
    userLogService.record("workspace.member_add", {
      actorId: actor.actorId,
      targetId: userId,
      metadata: { workspaceId, role },
    });
  }

  removeMember(workspaceId: number, userId: number, actor: Actor = {}): void {
    workspaceMembersRepository.remove(workspaceId, userId);
    userLogService.record("workspace.member_remove", {
      actorId: actor.actorId,
      targetId: userId,
      metadata: { workspaceId },
    });
  }

  private normalizeSlug(input: string): string {
    const slug = slugify(input);
    if (!slug) throw new WorkspaceServiceError("Slug must contain letters or numbers.");
    return slug;
  }

  private normalizeRole(role: WorkspaceRole): WorkspaceRole {
    return WORKSPACE_ROLES.includes(role) ? role : "member";
  }
}

export const workspaceService = new WorkspaceService();
