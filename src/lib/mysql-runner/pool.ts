import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

import { acquireTunnel, type TunnelHandle } from "@/lib/ssh-tunnel";

import type { RunnerConfig } from "./config";
import type { Logger } from "./logger";
import type {
  ConnectionInfo,
  ConnectionStatus,
  OpenConnectionOptions,
  QueryFieldMeta,
} from "./types";

const DEFAULT_MYSQL_PORT = 3306;

function normalizeFields(fields: unknown): QueryFieldMeta[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => {
    const field = f as { name: string; type?: number; table?: string };
    return { name: field.name, type: field.type, table: field.table };
  });
}

/**
 * One mysql2 connection pool, optionally fed through an SSH tunnel. Owns the
 * tunnel reference for its lifetime and releases it on close.
 */
export class DbPool {
  readonly id: string;
  readonly opts: OpenConnectionOptions;
  private readonly config: RunnerConfig;
  private readonly log: Logger;

  private pool?: Pool;
  private tunnel?: TunnelHandle;
  private localHost: string;
  private localPort: number;

  status: ConnectionStatus = "connecting";
  lastError?: string;

  private readonly createdAt = new Date();
  private lastActivityAt = new Date();
  private totalQueries = 0;
  private activeQueries = 0;
  private errors = 0;
  private closing = false;

  private readonly ready: Promise<void>;

  constructor(id: string, opts: OpenConnectionOptions, config: RunnerConfig, log: Logger) {
    this.id = id;
    this.opts = opts;
    this.config = config;
    this.log = log.child({ conn: id });
    this.localHost = opts.connection.host;
    this.localPort = opts.connection.port ?? DEFAULT_MYSQL_PORT;
    this.ready = this.start();
  }

  get tunneled(): boolean {
    return Boolean(this.opts.ssh);
  }

  get connectionLimit(): number {
    return this.opts.connection.connectionLimit ?? this.config.defaultConnectionLimit;
  }

  get idleTimeoutMs(): number {
    return this.opts.idleTimeoutMs ?? this.config.defaultIdleTimeoutMs;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private async start(): Promise<void> {
    try {
      // 1. If requested, bring up (or join) an SSH tunnel and retarget the pool
      //    at the loopback endpoint it exposes.
      if (this.opts.ssh) {
        this.tunnel = await acquireTunnel({
          ssh: this.opts.ssh,
          target: {
            host: this.opts.connection.host,
            port: this.opts.connection.port ?? DEFAULT_MYSQL_PORT,
          },
          label: this.opts.label ?? `db:${this.opts.connection.host}`,
        });
        this.localHost = this.tunnel.host;
        this.localPort = this.tunnel.port;
      }

      // 2. Create the pool.
      this.pool = mysql.createPool(this.buildPoolOptions());

      // 3. Fail fast: actually acquire one connection so bad creds/host surface now.
      const conn = await this.pool.getConnection();
      conn.release();

      this.status = "ready";
      this.log.info(
        { host: this.localHost, port: this.localPort, tunneled: this.tunneled },
        "pool ready",
      );
    } catch (err) {
      this.status = "error";
      this.lastError = err instanceof Error ? err.message : String(err);
      // Roll back partial resources before surfacing.
      await this.pool?.end().catch(() => {});
      this.pool = undefined;
      await this.tunnel?.release().catch(() => {});
      this.tunnel = undefined;
      throw err instanceof Error ? err : new Error(this.lastError);
    }
  }

  private buildPoolOptions(): PoolOptions {
    const c = this.opts.connection;
    const opts: PoolOptions = {
      host: this.localHost,
      port: this.localPort,
      user: c.user,
      password: c.password,
      database: c.database || undefined,
      connectTimeout: c.connectTimeout ?? this.config.connectTimeoutMs,
      multipleStatements: c.multipleStatements,
      charset: c.charset,
      timezone: c.timezone,
      ssl: c.ssl === true ? {} : c.ssl === false ? undefined : c.ssl,
      // pool behaviour
      waitForConnections: true,
      connectionLimit: this.connectionLimit,
      queueLimit: this.config.queueLimit,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    };

    for (const key of Object.keys(opts) as (keyof PoolOptions)[]) {
      if (opts[key] === undefined) delete opts[key];
    }
    return opts;
  }

  async query(sql: string, params?: unknown[]): Promise<{ rows: unknown; fields: QueryFieldMeta[] }> {
    if (!this.pool || this.status !== "ready") {
      throw new Error(`Connection ${this.id} is not ready (status: ${this.status}).`);
    }
    this.activeQueries += 1;
    this.totalQueries += 1;
    this.touch();
    try {
      const [rows, fields] = await this.pool.query(sql, params);
      return { rows, fields: normalizeFields(fields) };
    } catch (err) {
      this.errors += 1;
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.activeQueries -= 1;
      this.touch();
    }
  }

  private touch(): void {
    this.lastActivityAt = new Date();
  }

  isIdleExpired(now: number): boolean {
    if (this.idleTimeoutMs <= 0) return false;
    if (this.activeQueries > 0) return false;
    return now - this.lastActivityAt.getTime() >= this.idleTimeoutMs;
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.status = "closed";
    await this.pool?.end().catch(() => {});
    this.pool = undefined;
    await this.tunnel?.release().catch(() => {});
    this.tunnel = undefined;
    this.log.info("pool closed");
  }

  toInfo(): ConnectionInfo {
    const c = this.opts.connection;
    return {
      id: this.id,
      status: this.status,
      db: {
        host: c.host,
        port: c.port ?? DEFAULT_MYSQL_PORT,
        user: c.user,
        database: c.database,
      },
      tunneled: this.tunneled,
      tunnelId: this.tunnel?.id,
      localEndpoint: this.tunneled ? { host: this.localHost, port: this.localPort } : undefined,
      label: this.opts.label,
      connectionLimit: this.connectionLimit,
      idleTimeoutMs: this.idleTimeoutMs,
      createdAt: this.createdAt.toISOString(),
      lastActivityAt: this.lastActivityAt.toISOString(),
      totalQueries: this.totalQueries,
      activeQueries: this.activeQueries,
      errors: this.errors,
      lastError: this.lastError,
    };
  }
}
