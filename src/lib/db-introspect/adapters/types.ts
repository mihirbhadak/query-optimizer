/**
 * Per-engine introspection adapter contract. An adapter turns a bound query
 * runner into the structure metadata the repository persists. Adapters MUST only
 * issue cheap dictionary queries (information_schema / catalog) — never COUNT(*)
 * or anything that scans customer data.
 */

import type { TableMetaInput } from "@/lib/db";

import type { SyncPhase } from "../types";

/** Runs one read-only query and returns the rows. */
export type RunFn = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Report coarse progress; the manager maps the phase to a percentage. */
export type ProgressFn = (
  phase: SyncPhase,
  extra?: { tablesDone?: number; tablesTotal?: number },
) => void;

export interface IntrospectResult {
  /** Resolved engine family/name, e.g. "mysql" or "mariadb". */
  engine: string;
  /** Full server version string. */
  version: string;
  tables: TableMetaInput[];
  totalSizeBytes: number;
}

export interface EngineAdapter {
  introspect(run: RunFn, schema: string | undefined, onProgress: ProgressFn): Promise<IntrospectResult>;
}
