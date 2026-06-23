/**
 * DB-free types for the schema-introspection service. Safe to import from client
 * components (no better-sqlite3 / no node deps) — only type aliases and constants.
 */

import type { SyncStatus, SyncTrigger } from "@/types/db";

export type { SyncStatus, SyncTrigger };

/** Ordered phases of a sync run; each maps to a coarse progress percentage. */
export type SyncPhase =
  | "queued"
  | "connecting"
  | "version"
  | "tables"
  | "columns"
  | "indexes"
  | "sizes"
  | "writing"
  | "done";

export const PHASE_PROGRESS: Record<SyncPhase, number> = {
  queued: 0,
  connecting: 5,
  version: 10,
  tables: 25,
  columns: 45,
  indexes: 70,
  sizes: 85,
  writing: 95,
  done: 100,
};

export const PHASE_LABEL: Record<SyncPhase, string> = {
  queued: "Queued",
  connecting: "Connecting",
  version: "Reading server version",
  tables: "Reading tables",
  columns: "Reading columns",
  indexes: "Reading indexes",
  sizes: "Measuring sizes",
  writing: "Saving",
  done: "Done",
};

/** Live, pollable view of a sync job (mirrors db_sync_jobs + in-memory state). */
export interface SyncJobView {
  jobId: number;
  databaseId: number;
  status: SyncStatus;
  phase: SyncPhase | null;
  progress: number;
  tablesDone: number;
  tablesTotal: number;
  engine: string | null;
  engineVersion: string | null;
  tableCount: number | null;
  totalSizeBytes: number | null;
  error: string | null;
  trigger: SyncTrigger;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

/** A database older than this (or never synced) is suggested for a re-sync. */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
