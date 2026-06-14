/**
 * In-process pooled MySQL runner types.
 *
 * The runner keeps one connection pool per unique database (optionally reached
 * through an SSH tunnel) and runs queries against it. It depends on the
 * ssh-tunnel library for the SSH part; the dependency arrow is one-way:
 *
 *   mysql-runner -> ssh-tunnel
 */

import type { SshConfig } from "@/lib/ssh-tunnel";

/** TLS settings passed through to mysql2 / Node's TLS. */
export type DbSsl =
  | boolean
  | { rejectUnauthorized?: boolean; ca?: string; cert?: string; key?: string };

/** Everything needed to open a pool to one database. */
export interface DbConnectionConfig {
  host: string;
  /** Defaults to 3306. */
  port?: number;
  user: string;
  password?: string;
  /** Optional default schema. */
  database?: string;

  // ---- pool / driver options (all optional, sensible defaults applied) ----
  /** Max connections in this pool. Defaults to the manager default. */
  connectionLimit?: number;
  /** Per-connection connect timeout (ms). */
  connectTimeout?: number;
  charset?: string;
  /** e.g. "Z", "+05:30", "local". */
  timezone?: string;
  /** Allow several `;`-separated statements per query. */
  multipleStatements?: boolean;
  /** `true` => TLS with defaults; object => passed to Node TLS; omit => no TLS. */
  ssl?: DbSsl;
}

export interface OpenConnectionOptions {
  connection: DbConnectionConfig;
  /** Provide to tunnel the DB connection through SSH; omit to connect directly. */
  ssh?: SshConfig;
  /** Auto-close the pool after this many ms with no queries. Omit = manager default. */
  idleTimeoutMs?: number;
  /** Free-form label for listings/logs (no secrets). */
  label?: string;
}

export interface RunQueryOptions extends OpenConnectionOptions {
  /** SQL to run. With `multipleStatements`, may contain several statements. */
  query: string;
  /** Bound parameters for `?` placeholders. */
  params?: unknown[];
  /** When true, reject anything that isn't a read (SELECT/SHOW/DESCRIBE/EXPLAIN/WITH). */
  readOnly?: boolean;
}

export interface QueryFieldMeta {
  name: string;
  type?: number;
  table?: string;
}

export interface QueryResult {
  /** Rows for SELECT-like statements, or a result-header object for writes. */
  rows: unknown;
  fields: QueryFieldMeta[];
  rowCount: number;
  durationMs: number;
  tunneled: boolean;
  /** Id of the pool that served the query. */
  connectionId: string;
}

export type ConnectionStatus = "connecting" | "ready" | "error" | "closed";

/** Public, secret-free view of a pool. */
export interface ConnectionInfo {
  id: string;
  status: ConnectionStatus;
  db: { host: string; port: number; user: string; database?: string };
  tunneled: boolean;
  tunnelId?: string;
  /** The loopback endpoint mysql2 actually connects to when tunneled. */
  localEndpoint?: { host: string; port: number };
  label?: string;
  connectionLimit: number;
  idleTimeoutMs: number;
  createdAt: string;
  lastActivityAt: string;
  totalQueries: number;
  activeQueries: number;
  errors: number;
  lastError?: string;
}
