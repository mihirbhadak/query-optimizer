/**
 * Background schema-sync orchestrator (one per process, kept on globalThis so it
 * survives Next.js hot reloads — like the mysql-runner's DatabaseManager).
 *
 * Guarantees:
 *  - Many DIFFERENT databases sync in parallel (up to MAX_CONCURRENT).
 *  - The SAME database never runs twice at once (per-database mutex via `running`).
 *  - Duplicate requests for an already active/queued database return the live job.
 *  - Each run persists progress + timing to db_sync_jobs; results are swapped in
 *    one transaction so reads are never blocked or left partial.
 *
 * Callable from anywhere on the server: `syncManager.requestSync(databaseId)`.
 */

import {
  databasesRepository,
  introspectionRepository,
  nowTs,
  syncJobsRepository,
} from "@/lib/db";
import type { DbSyncJob, SyncTrigger } from "@/types/db";

import { getAdapter } from "./adapters";
import { openIntrospectConnection } from "./introspect-runner";
import { PHASE_PROGRESS, type SyncJobView, type SyncPhase } from "./types";

const MAX_CONCURRENT = Number(process.env.SCHEMA_SYNC_CONCURRENCY) || 4;

export interface RequestResult {
  jobId: number;
  status: "queued" | "running";
  /** True when an existing job was returned instead of creating a new one. */
  alreadyActive: boolean;
}

export interface SyncJobDetailedView extends SyncJobView {
  databaseName: string;
  workspaceId: number;
  workspaceSlug: string;
}

interface RunningState {
  jobId: number;
  databaseId: number;
  phase: SyncPhase;
  progress: number;
  tablesDone: number;
  tablesTotal: number;
  engine: string | null;
  engineVersion: string | null;
  startedAtMs: number;
}

function rowToView(job: DbSyncJob): SyncJobView {
  return {
    jobId: job.id,
    databaseId: job.database_id,
    status: job.status,
    phase: (job.phase as SyncPhase) ?? null,
    progress: job.progress,
    tablesDone: job.tables_done,
    tablesTotal: job.tables_total,
    engine: job.engine,
    engineVersion: job.engine_version,
    tableCount: job.table_count,
    totalSizeBytes: job.total_size_bytes,
    error: job.error,
    trigger: job.trigger,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    durationMs: job.duration_ms,
  };
}

class SyncManager {
  /** databaseId -> live state. Presence here is the per-database mutex. */
  private running = new Map<number, RunningState>();
  private queue: { databaseId: number; jobId: number }[] = [];
  private queued = new Set<number>();

  constructor() {
    // Jobs left mid-flight by a previous process can never resume; mark them done.
    try {
      syncJobsRepository.failStale();
    } catch {
      // DB may not be migrated yet on first boot; ignore.
    }
  }

  requestSync(
    databaseId: number,
    opts: { requestedBy?: number | null; trigger?: SyncTrigger } = {},
  ): RequestResult {
    const active = this.running.get(databaseId);
    if (active) return { jobId: active.jobId, status: "running", alreadyActive: true };
    if (this.queued.has(databaseId)) {
      const q = this.queue.find((x) => x.databaseId === databaseId)!;
      return { jobId: q.jobId, status: "queued", alreadyActive: true };
    }

    const job = syncJobsRepository.create({
      databaseId,
      trigger: opts.trigger ?? "manual",
      requestedBy: opts.requestedBy ?? null,
    });
    this.queue.push({ databaseId, jobId: job.id });
    this.queued.add(databaseId);
    this.pump();
    return { jobId: job.id, status: "queued", alreadyActive: false };
  }

  private pump(): void {
    while (this.running.size < MAX_CONCURRENT && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.queued.delete(next.databaseId);
      if (this.running.has(next.databaseId)) continue; // safety; dedupe should prevent this
      void this.runJob(next.databaseId, next.jobId);
    }
  }

  private async runJob(databaseId: number, jobId: number): Promise<void> {
    const state: RunningState = {
      jobId,
      databaseId,
      phase: "connecting",
      progress: PHASE_PROGRESS.connecting,
      tablesDone: 0,
      tablesTotal: 0,
      engine: null,
      engineVersion: null,
      startedAtMs: Date.now(),
    };
    this.running.set(databaseId, state);
    syncJobsRepository.update(jobId, {
      status: "running",
      phase: "connecting",
      progress: state.progress,
      started_at: nowTs(),
    });

    let conn: { close: () => Promise<void> } | undefined;
    try {
      const dbRow = databasesRepository.getSafe(databaseId);
      if (!dbRow) throw new Error("Database not found.");
      const adapter = getAdapter(dbRow.engine);

      conn = await openIntrospectConnection(databaseId);
      const live = conn as { run: Parameters<typeof adapter.introspect>[0]; close: () => Promise<void> };

      const result = await adapter.introspect(live.run, dbRow.db_name ?? undefined, (phase, extra) => {
        state.phase = phase;
        state.progress = PHASE_PROGRESS[phase];
        if (extra?.tablesTotal !== undefined) state.tablesTotal = extra.tablesTotal;
        if (extra?.tablesDone !== undefined) state.tablesDone = extra.tablesDone;
        // Phases are few, so persisting each one is cheap.
        syncJobsRepository.update(jobId, {
          phase,
          progress: state.progress,
          tables_total: state.tablesTotal,
          tables_done: state.tablesDone,
        });
      });
      state.engine = result.engine;
      state.engineVersion = result.version;

      // Atomic replace, then finalize.
      introspectionRepository.replaceSchema(databaseId, result.tables);
      databasesRepository.markSynced(databaseId);

      syncJobsRepository.update(jobId, {
        status: "success",
        phase: "done",
        progress: 100,
        engine: result.engine,
        engine_version: result.version,
        table_count: result.tables.length,
        total_size_bytes: result.totalSizeBytes,
        tables_total: result.tables.length,
        tables_done: result.tables.length,
        finished_at: nowTs(),
        duration_ms: Date.now() - state.startedAtMs,
      });
    } catch (err) {
      syncJobsRepository.update(jobId, {
        status: "failed",
        error: err instanceof Error ? err.message : "Sync failed.",
        finished_at: nowTs(),
        duration_ms: Date.now() - state.startedAtMs,
      });
    } finally {
      await conn?.close();
      this.running.delete(databaseId);
      this.pump();
    }
  }

  /** Overlay fresh in-memory progress onto a persisted row when it's running here. */
  private overlay(view: SyncJobView): SyncJobView {
    const s = this.running.get(view.databaseId);
    if (!s || s.jobId !== view.jobId) return view;
    return {
      ...view,
      status: "running",
      phase: s.phase,
      progress: s.progress,
      tablesDone: s.tablesDone,
      tablesTotal: s.tablesTotal,
      engine: s.engine ?? view.engine,
      engineVersion: s.engineVersion ?? view.engineVersion,
    };
  }

  /** Latest job view for a database (live if running), or null if never synced. */
  getStatus(databaseId: number): SyncJobView | null {
    const job = syncJobsRepository.getLatest(databaseId);
    return job ? this.overlay(rowToView(job)) : null;
  }

  /** All active (queued/running) jobs across databases, enriched for the dashboard. */
  listActive(): SyncJobDetailedView[] {
    return syncJobsRepository.listActiveDetailed().map((row) => ({
      ...this.overlay(rowToView(row)),
      databaseName: row.database_name,
      workspaceId: row.workspace_id,
      workspaceSlug: row.workspace_slug,
    }));
  }
}

const globalRef = globalThis as unknown as { __schemaSyncManager?: SyncManager };
export const syncManager: SyncManager =
  globalRef.__schemaSyncManager ?? (globalRef.__schemaSyncManager = new SyncManager());
