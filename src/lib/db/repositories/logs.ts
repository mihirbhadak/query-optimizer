import { db } from "../client";
import type { LogLevel, SystemLog, UserLog } from "@/types/db";

export interface UserLogEntry {
  workspaceId?: number;
  userId?: number;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemLogEntry {
  level?: LogLevel;
  source?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Append-only audit of user actions (architecture rule: audit every action). */
export const userLogsRepository = {
  record(e: UserLogEntry): UserLog {
    const info = db
      .prepare(
        `INSERT INTO user_logs (workspace_id, user_id, action, target_type, target_id, ip_address, metadata)
         VALUES (@workspace_id, @user_id, @action, @target_type, @target_id, @ip_address, @metadata)`,
      )
      .run({
        workspace_id: e.workspaceId ?? null,
        user_id: e.userId ?? null,
        action: e.action,
        target_type: e.targetType ?? null,
        target_id: e.targetId ?? null,
        ip_address: e.ipAddress ?? null,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      });
    return db.prepare("SELECT * FROM user_logs WHERE id = ?").get(Number(info.lastInsertRowid)) as UserLog;
  },

  listForWorkspace(workspaceId: number, limit = 100): UserLog[] {
    return db
      .prepare("SELECT * FROM user_logs WHERE workspace_id = ? ORDER BY id DESC LIMIT ?")
      .all(workspaceId, limit) as UserLog[];
  },

  forUser(userId: number, limit = 100): UserLog[] {
    return db
      .prepare("SELECT * FROM user_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?")
      .all(userId, limit) as UserLog[];
  },

  recent(limit = 100): UserLog[] {
    return db.prepare("SELECT * FROM user_logs ORDER BY id DESC LIMIT ?").all(limit) as UserLog[];
  },
};

/** Append-only system events / errors. */
export const systemLogsRepository = {
  record(e: SystemLogEntry): SystemLog {
    const info = db
      .prepare(
        `INSERT INTO system_logs (level, source, message, metadata)
         VALUES (@level, @source, @message, @metadata)`,
      )
      .run({
        level: e.level ?? "info",
        source: e.source ?? null,
        message: e.message,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      });
    return db
      .prepare("SELECT * FROM system_logs WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as SystemLog;
  },

  recent(limit = 100): SystemLog[] {
    return db.prepare("SELECT * FROM system_logs ORDER BY id DESC LIMIT ?").all(limit) as SystemLog[];
  },
};
