/**
 * Schema-sync job rows: the persisted queue + progress + per-run metadata for the
 * introspection service (see src/lib/db-introspect). The sync manager keeps a
 * fast in-memory view for polling; these rows are the durable history.
 */

import type { DbSyncJob, SyncTrigger } from "@/types/db";

import { db } from "../client";

/** SQLite CURRENT_TIMESTAMP format (UTC, no ms) so values sort with other rows. */
export function nowTs(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export interface SyncJobDetailed extends DbSyncJob {
  database_name: string;
  workspace_id: number;
  workspace_slug: string;
}

export interface SyncJobPatch {
  status?: DbSyncJob["status"];
  phase?: string | null;
  progress?: number;
  tables_total?: number;
  tables_done?: number;
  engine?: string | null;
  engine_version?: string | null;
  table_count?: number | null;
  total_size_bytes?: number | null;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
}

export const syncJobsRepository = {
  create(input: { databaseId: number; trigger?: SyncTrigger; requestedBy?: number | null }): DbSyncJob {
    const info = db
      .prepare(
        `INSERT INTO db_sync_jobs (database_id, status, trigger, requested_by, progress)
         VALUES (?, 'queued', ?, ?, 0)`,
      )
      .run(input.databaseId, input.trigger ?? "manual", input.requestedBy ?? null);
    return this.get(Number(info.lastInsertRowid))!;
  },

  update(id: number, patch: SyncJobPatch): void {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;
    const set = entries.map(([k]) => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE db_sync_jobs SET ${set} WHERE id = @id`).run({
      ...Object.fromEntries(entries),
      id,
    });
  },

  get(id: number): DbSyncJob | undefined {
    return db.prepare("SELECT * FROM db_sync_jobs WHERE id = ?").get(id) as DbSyncJob | undefined;
  },

  getLatest(databaseId: number): DbSyncJob | undefined {
    return db
      .prepare("SELECT * FROM db_sync_jobs WHERE database_id = ? ORDER BY id DESC LIMIT 1")
      .get(databaseId) as DbSyncJob | undefined;
  },

  listByDatabase(databaseId: number, limit = 20): DbSyncJob[] {
    return db
      .prepare("SELECT * FROM db_sync_jobs WHERE database_id = ? ORDER BY id DESC LIMIT ?")
      .all(databaseId, limit) as DbSyncJob[];
  },

  /** Active (queued/running) jobs across all databases, with db + workspace info. */
  listActiveDetailed(): SyncJobDetailed[] {
    return db
      .prepare(
        `SELECT j.*, d.name AS database_name, d.workspace_id AS workspace_id, w.slug AS workspace_slug
           FROM db_sync_jobs j
           JOIN databases d ON d.id = j.database_id
           JOIN workspaces w ON w.id = d.workspace_id
          WHERE j.status IN ('queued', 'running')
          ORDER BY j.id DESC`,
      )
      .all() as SyncJobDetailed[];
  },

  /** Mark jobs left 'running'/'queued' by a previous process as canceled (startup recovery). */
  failStale(): number {
    const info = db
      .prepare(
        `UPDATE db_sync_jobs
            SET status = 'canceled', error = 'Interrupted (server restarted)', finished_at = ?
          WHERE status IN ('queued', 'running')`,
      )
      .run(nowTs());
    return info.changes;
  },
};
