/**
 * Public, in-process API for the pooled MySQL runner.
 *
 * Connect to any MySQL database — directly or through an SSH tunnel — and run
 * queries, with one persistent connection pool kept per unique database. Many
 * different databases can be active at once.
 *
 *   import { runQuery } from "@/lib/mysql-runner";
 *
 *   const result = await runQuery({
 *     connection: { host: "db.internal", user: "app", password, database: "shop" },
 *     ssh: { host: "bastion", username: "ubuntu", auth: { method: "privateKey", privateKey } },
 *     query: "SELECT * FROM products WHERE id = ?",
 *     params: [42],
 *   });
 *
 * The pool (and any SSH tunnel under it) is created on first use, reused by
 * subsequent calls to the same database, and auto-closed when idle.
 */

import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { DatabaseManager } from "./manager";
import type {
  ConnectionInfo,
  OpenConnectionOptions,
  QueryResult,
  RunQueryOptions,
} from "./types";

// One manager per process; persists across Next.js dev hot-reloads so pools and
// tunnels aren't leaked on every edit.
const globalRef = globalThis as unknown as { __mysqlRunner?: DatabaseManager };

export const databaseManager: DatabaseManager =
  globalRef.__mysqlRunner ?? (globalRef.__mysqlRunner = new DatabaseManager(loadConfig(), createLogger()));

/** Open/reuse a pool and run a query. */
export function runQuery(opts: RunQueryOptions): Promise<QueryResult> {
  return databaseManager.runQuery(opts);
}

/** Run a query against an already-open pool by id. */
export function runQueryOn(
  id: string,
  query: string,
  params?: unknown[],
  readOnly = false,
): Promise<QueryResult> {
  return databaseManager.runQueryOn(id, query, params, readOnly);
}

/** Open (or reuse) a pool without running a query — e.g. to test a connection. */
export function ensureConnection(opts: OpenConnectionOptions): Promise<ConnectionInfo> {
  return databaseManager.ensureConnection(opts);
}

export function getConnection(id: string): ConnectionInfo | undefined {
  return databaseManager.get(id);
}

export function listConnections(): ConnectionInfo[] {
  return databaseManager.list();
}

export function closeConnection(id: string): Promise<{ closed: boolean }> {
  return databaseManager.close(id);
}

export type {
  ConnectionInfo,
  ConnectionStatus,
  DbConnectionConfig,
  DbSsl,
  OpenConnectionOptions,
  QueryFieldMeta,
  QueryResult,
  RunQueryOptions,
} from "./types";
