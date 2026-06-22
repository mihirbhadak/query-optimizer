/**
 * UserLogService — the single place that writes/reads the `user_logs` audit
 * trail. Business code calls `record(action, ...)`; nothing else touches the log
 * repository directly.
 */

import { userLogsRepository } from "@/lib/db";
import type { UserLog } from "@/types/db";

export interface UserLogInput {
  /** Who performed the action. */
  actorId?: number;
  /** Which user the action targeted (if any). */
  targetId?: number;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export class UserLogService {
  /** Append an audit entry. `action` is a dotted event name, e.g. "user.create". */
  record(action: string, input: UserLogInput = {}): UserLog {
    return userLogsRepository.record({
      userId: input.actorId,
      action,
      targetType: input.targetId != null ? "user" : undefined,
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
}

export const userLogService = new UserLogService();
