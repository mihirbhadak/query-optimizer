/** Manager tuning. Sensible defaults; every value is overridable by env. */

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface RunnerConfig {
  /** Default pool size when a connection doesn't specify one. */
  defaultConnectionLimit: number;
  /** Default idle timeout (ms). 0 = pools persist until closed. */
  defaultIdleTimeoutMs: number;
  /** Max concurrent pools (distinct databases). */
  maxPools: number;
  /** mysql2 connect timeout (ms). */
  connectTimeoutMs: number;
  /** mysql2 queue limit (0 = unlimited queued acquisitions). */
  queueLimit: number;
}

export function loadConfig(): RunnerConfig {
  return {
    defaultConnectionLimit: int("MYSQL_RUNNER_CONNECTION_LIMIT", 10),
    // Matches the PROJECT_GUIDE connection-pooling spec (60s idle, auto cleanup).
    defaultIdleTimeoutMs: int("MYSQL_RUNNER_IDLE_TIMEOUT_MS", 60000),
    maxPools: int("MYSQL_RUNNER_MAX_POOLS", 100),
    connectTimeoutMs: int("MYSQL_RUNNER_CONNECT_TIMEOUT_MS", 15000),
    queueLimit: int("MYSQL_RUNNER_QUEUE_LIMIT", 0),
  };
}
