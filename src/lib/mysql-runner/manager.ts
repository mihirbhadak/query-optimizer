import type { RunnerConfig } from "./config";
import type { Logger } from "./logger";
import type {
  ConnectionInfo,
  OpenConnectionOptions,
  QueryResult,
  RunQueryOptions,
} from "./types";
import { fingerprint } from "./fingerprint";
import { DbPool } from "./pool";
import { assertReadOnly } from "./query-guard";

const IDLE_SWEEP_INTERVAL_MS = 5000;

function validateOpen(opts: OpenConnectionOptions): void {
  if (!opts || typeof opts !== "object") throw new Error("Options are required.");
  const c = opts.connection;
  if (!c?.host) throw new Error("connection.host is required.");
  if (!c?.user) throw new Error("connection.user is required.");
  if (opts.ssh) {
    if (!opts.ssh.host) throw new Error("ssh.host is required when tunneling.");
    if (!opts.ssh.username) throw new Error("ssh.username is required when tunneling.");
    if (!opts.ssh.auth) throw new Error("ssh.auth is required when tunneling.");
  }
}

/**
 * Owns the set of live DB pools. One pool per unique (database + credentials +
 * ssh path); concurrent opens of the same target share a pool. Pools persist
 * across queries (that's the point of pooling) and are reaped when idle.
 */
export class DatabaseManager {
  private readonly pools = new Map<string, DbPool>();
  private readonly pending = new Map<string, Promise<DbPool>>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    private readonly config: RunnerConfig,
    private readonly log: Logger,
  ) {
    this.sweepTimer = setInterval(() => this.sweepIdle(), IDLE_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
  }

  /** Get-or-create the pool for these options. */
  private async ensurePool(opts: OpenConnectionOptions): Promise<DbPool> {
    validateOpen(opts);
    const id = fingerprint(opts);

    const existing = this.pools.get(id);
    if (existing && existing.status !== "closed" && existing.status !== "error") {
      return existing;
    }

    const inFlight = this.pending.get(id);
    if (inFlight) return inFlight;

    if (this.pools.size >= this.config.maxPools) {
      throw new Error(`Connection pool limit reached (${this.config.maxPools}).`);
    }

    const create = (async () => {
      const pool = new DbPool(id, opts, this.config, this.log);
      try {
        await pool.whenReady();
      } catch (err) {
        await pool.close().catch(() => {});
        throw err instanceof Error ? err : new Error("Failed to open connection.");
      }
      this.pools.set(id, pool);
      this.log.info({ conn: id, total: this.pools.size }, "pool opened");
      return pool;
    })();

    this.pending.set(id, create);
    try {
      return await create;
    } finally {
      this.pending.delete(id);
    }
  }

  /** Open (or reuse) a pool without running a query. Useful for "test connection". */
  async ensureConnection(opts: OpenConnectionOptions): Promise<ConnectionInfo> {
    const pool = await this.ensurePool(opts);
    return pool.toInfo();
  }

  /** Open/reuse a pool and run a query against it. */
  async runQuery(opts: RunQueryOptions): Promise<QueryResult> {
    if (!opts.query || !opts.query.trim()) throw new Error("query is required.");
    if (opts.readOnly) assertReadOnly(opts.query);

    const pool = await this.ensurePool(opts);
    const start = performance.now();
    const { rows, fields } = await pool.query(opts.query, opts.params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      rows,
      fields,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      durationMs,
      tunneled: pool.tunneled,
      connectionId: pool.id,
    };
  }

  /** Run a query against an already-open pool by id. */
  async runQueryOn(
    id: string,
    query: string,
    params?: unknown[],
    readOnly = false,
  ): Promise<QueryResult> {
    const pool = this.pools.get(id);
    if (!pool) throw new Error(`No connection with id ${id}.`);
    if (!query || !query.trim()) throw new Error("query is required.");
    if (readOnly) assertReadOnly(query);

    const start = performance.now();
    const { rows, fields } = await pool.query(query, params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      rows,
      fields,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      durationMs,
      tunneled: pool.tunneled,
      connectionId: pool.id,
    };
  }

  get(id: string): ConnectionInfo | undefined {
    return this.pools.get(id)?.toInfo();
  }

  list(): ConnectionInfo[] {
    return [...this.pools.values()].map((p) => p.toInfo());
  }

  async close(id: string): Promise<{ closed: boolean }> {
    const pool = this.pools.get(id);
    if (!pool) return { closed: false };
    this.pools.delete(id);
    await pool.close();
    return { closed: true };
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const [id, pool] of this.pools) {
      if (pool.isIdleExpired(now)) {
        this.log.info({ conn: id }, "reaping idle pool");
        this.pools.delete(id);
        void pool.close().catch(() => {});
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.sweepTimer);
    const all = [...this.pools.values()];
    this.pools.clear();
    await Promise.allSettled(all.map((p) => p.close()));
  }
}
