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

/** A user-log row joined with the actor's username/email (for display). */
export interface UserLogWithUser extends UserLog {
  username: string | null;
  email: string | null;
}

export interface UserLogQuery {
  search?: string;
  action?: string;
  userId?: number;
  workspaceId?: number;
  /** Inclusive date bounds, "YYYY-MM-DD". */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface SystemLogQuery {
  search?: string;
  level?: LogLevel;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function userWhere(q: UserLogQuery): { sql: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (q.action) {
    cond.push("l.action = ?");
    params.push(q.action);
  }
  if (q.userId != null) {
    cond.push("l.user_id = ?");
    params.push(q.userId);
  }
  if (q.workspaceId != null) {
    cond.push("l.workspace_id = ?");
    params.push(q.workspaceId);
  }
  if (q.from) {
    cond.push("l.created_at >= ?");
    params.push(q.from);
  }
  if (q.to) {
    cond.push("l.created_at <= ?");
    params.push(`${q.to} 23:59:59`);
  }
  if (q.search) {
    const s = `%${q.search}%`;
    cond.push(
      "(l.action LIKE ? OR l.target_type LIKE ? OR l.target_id LIKE ? OR l.metadata LIKE ? OR u.username LIKE ?)",
    );
    params.push(s, s, s, s, s);
  }
  return { sql: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
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

  /** Filtered + paginated audit entries, joined with the actor's username. */
  query(q: UserLogQuery): UserLogWithUser[] {
    const { sql, params } = userWhere(q);
    return db
      .prepare(
        `SELECT l.*, u.username AS username, u.email AS email
           FROM user_logs l LEFT JOIN users u ON u.id = l.user_id
           ${sql}
          ORDER BY l.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, q.limit ?? 50, q.offset ?? 0) as UserLogWithUser[];
  },

  count(q: UserLogQuery): number {
    const { sql, params } = userWhere(q);
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM user_logs l LEFT JOIN users u ON u.id = l.user_id ${sql}`,
      )
      .get(...params) as { n: number };
    return row.n;
  },

  distinctActions(): string[] {
    return (db.prepare("SELECT DISTINCT action FROM user_logs ORDER BY action").all() as { action: string }[]).map(
      (r) => r.action,
    );
  },

  total(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM user_logs").get() as { n: number }).n;
  },

  deleteAll(): number {
    return db.prepare("DELETE FROM user_logs").run().changes;
  },

  /** Delete entries older than `days` (UTC). No-op when days <= 0. */
  deleteOlderThan(days: number): number {
    if (days <= 0) return 0;
    return db
      .prepare("DELETE FROM user_logs WHERE created_at < datetime('now', ?)")
      .run(`-${Math.floor(days)} days`).changes;
  },
};

function systemWhere(q: SystemLogQuery): { sql: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (q.level) {
    cond.push("level = ?");
    params.push(q.level);
  }
  if (q.source) {
    cond.push("source = ?");
    params.push(q.source);
  }
  if (q.from) {
    cond.push("created_at >= ?");
    params.push(q.from);
  }
  if (q.to) {
    cond.push("created_at <= ?");
    params.push(`${q.to} 23:59:59`);
  }
  if (q.search) {
    const s = `%${q.search}%`;
    cond.push("(message LIKE ? OR source LIKE ? OR metadata LIKE ?)");
    params.push(s, s, s);
  }
  return { sql: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

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

  query(q: SystemLogQuery): SystemLog[] {
    const { sql, params } = systemWhere(q);
    return db
      .prepare(`SELECT * FROM system_logs ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, q.limit ?? 50, q.offset ?? 0) as SystemLog[];
  },

  count(q: SystemLogQuery): number {
    const { sql, params } = systemWhere(q);
    const row = db.prepare(`SELECT COUNT(*) AS n FROM system_logs ${sql}`).get(...params) as { n: number };
    return row.n;
  },

  distinctSources(): string[] {
    return (
      db
        .prepare("SELECT DISTINCT source FROM system_logs WHERE source IS NOT NULL ORDER BY source")
        .all() as { source: string }[]
    ).map((r) => r.source);
  },

  total(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM system_logs").get() as { n: number }).n;
  },

  deleteAll(): number {
    return db.prepare("DELETE FROM system_logs").run().changes;
  },

  /** Delete entries older than `days` (UTC). No-op when days <= 0. */
  deleteOlderThan(days: number): number {
    if (days <= 0) return 0;
    return db
      .prepare("DELETE FROM system_logs WHERE created_at < datetime('now', ?)")
      .run(`-${Math.floor(days)} days`).changes;
  },
};
