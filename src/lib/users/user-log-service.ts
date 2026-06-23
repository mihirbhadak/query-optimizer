/**
 * UserLogService — the single place that writes/reads the `user_logs` audit
 * trail. Business code calls `record(action, ...)`; nothing else touches the log
 * repository directly.
 */

import {
  userLogsRepository,
  type UserLogQuery,
  type UserLogWithUser,
} from "@/lib/db";
import type { UserLog } from "@/types/db";

export interface UserLogInput {
  /** Who performed the action. */
  actorId?: number;
  /** Which entity the action targeted (defaults targetType to "user" for back-compat). */
  targetId?: number | string;
  /** Kind of target, e.g. "user", "workspace", "database". */
  targetType?: string;
  /** Workspace the action happened in (if any). */
  workspaceId?: number;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export class UserLogService {
  /** Append an audit entry. `action` is a dotted event name, e.g. "user.create". */
  record(action: string, input: UserLogInput = {}): UserLog {
    const targetType = input.targetType ?? (input.targetId != null ? "user" : undefined);
    return userLogsRepository.record({
      workspaceId: input.workspaceId,
      userId: input.actorId,
      action,
      targetType,
      targetId: input.targetId != null ? String(input.targetId) : undefined,
      ipAddress: input.ip,
      metadata: input.metadata,
    });
  }

  /** Entries where the user was the actor. */
  forUser(userId: number, limit = 100): UserLog[] {
    return userLogsRepository.forUser(userId, limit);
  }

  recent(limit = 100): UserLog[] {
    return userLogsRepository.recent(limit);
  }

  /** Filtered + paginated entries (admin log viewer). */
  query(q: UserLogQuery): UserLogWithUser[] {
    return userLogsRepository.query(q);
  }

  count(q: UserLogQuery): number {
    return userLogsRepository.count(q);
  }

  /** Distinct action names, for the filter dropdown. */
  actions(): string[] {
    return userLogsRepository.distinctActions();
  }
}

export const userLogService = new UserLogService();
