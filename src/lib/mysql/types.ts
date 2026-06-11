/**
 * Shared types for the dynamic MySQL query service.
 *
 * Everything needed to open a connection is passed in per request, so a single
 * deployment can talk to any MySQL server — optionally through an SSH tunnel.
 */

/** How to authenticate the SSH connection used for the tunnel. */
export type SshAuth =
  | { method: "password"; password: string }
  | {
      method: "privateKey";
      /** PEM-encoded private key contents (OpenSSH or PKCS#8). */
      privateKey: string;
      /** Passphrase, only if the private key is encrypted. */
      passphrase?: string;
    };

/** SSH tunnel settings. The MySQL host/port below are resolved *from the SSH host*. */
export interface SshTunnelConfig {
  host: string;
  /** SSH port, defaults to 22. */
  port?: number;
  username: string;
  auth: SshAuth;
  /** Verify the host fingerprint (sha256 hex, no colons). Optional. */
  expectedHostKeySha256?: string;
}

/** MySQL connection settings. Extra mysql2 options can be passed via `options`. */
export interface MysqlConnectionConfig {
  host: string;
  /** Defaults to 3306. */
  port?: number;
  user: string;
  password?: string;
  database?: string;

  // ---- common, frequently-toggled options (surfaced explicitly) ----
  /** Connect timeout in ms. */
  connectTimeout?: number;
  /** Allow multiple `;`-separated statements in a single query. */
  multipleStatements?: boolean;
  charset?: string;
  /** e.g. "Z" or "+05:30" or "local". */
  timezone?: string;
  /**
   * TLS. `true` enables TLS with default settings; an object is passed straight
   * to Node's TLS. `{ rejectUnauthorized: false }` allows self-signed certs.
   */
  ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string; cert?: string; key?: string };

  /** Escape hatch: any other mysql2 connection option, merged last. */
  options?: Record<string, unknown>;
}

export interface RunQueryRequest {
  connection: MysqlConnectionConfig;
  /** Omit to connect directly; provide to tunnel through SSH. */
  ssh?: SshTunnelConfig;
  /** SQL to run. With `multipleStatements`, may contain several statements. */
  query: string;
  /** Bound parameters for `?` placeholders. */
  params?: unknown[];
}

/** Request to verify the SSH connection (auth + reachability) — no MySQL involved. */
export interface TestTunnelRequest {
  ssh: SshTunnelConfig;
}

export interface TestTunnelResult {
  durationMs: number;
  /** Human-readable summary of the established SSH connection. */
  message: string;
}

export interface QueryFieldMeta {
  name: string;
  /** mysql2 numeric column type code. */
  type?: number;
  table?: string;
}

export interface RunQueryResult {
  /** Rows for SELECT-like statements, or a result-header object for writes. */
  rows: unknown;
  fields: QueryFieldMeta[];
  /** How many rows were returned (for arrays) — convenience for the UI. */
  rowCount: number;
  /** Wall-clock execution time in milliseconds. */
  durationMs: number;
  /** True when the query was tunneled through SSH. */
  tunneled: boolean;
}
