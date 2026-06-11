import mysql, { type ConnectionOptions } from "mysql2/promise";
import { Client as SshClient, type ConnectConfig } from "ssh2";
import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";

import type {
  MysqlConnectionConfig,
  RunQueryRequest,
  RunQueryResult,
  QueryFieldMeta,
  SshTunnelConfig,
  TestTunnelRequest,
  TestTunnelResult,
} from "./types";

const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_SSH_PORT = 22;

/** Translate our config shape into mysql2's ConnectionOptions. */
function buildMysqlOptions(cfg: MysqlConnectionConfig): ConnectionOptions {
  const { options, ...rest } = cfg;
  const opts: ConnectionOptions = {
    host: rest.host,
    port: rest.port ?? DEFAULT_MYSQL_PORT,
    user: rest.user,
    password: rest.password,
    database: rest.database || undefined,
    connectTimeout: rest.connectTimeout,
    multipleStatements: rest.multipleStatements,
    charset: rest.charset,
    timezone: rest.timezone,
    // mysql2 expects an object (or string profile); `true` => TLS with defaults,
    // `false`/undefined => no TLS.
    ssl: rest.ssl === true ? {} : rest.ssl === false ? undefined : rest.ssl,
  };

  // Drop undefined keys so mysql2 falls back to its own defaults.
  for (const key of Object.keys(opts) as (keyof ConnectionOptions)[]) {
    if (opts[key] === undefined) delete opts[key];
  }

  // Caller escape hatch wins last.
  return { ...opts, ...(options ?? {}) };
}

/**
 * Open an SSH connection and forward a channel to the MySQL host:port.
 * Resolves with the duplex stream (handed to mysql2) and the live SSH client
 * (so the caller can close it afterwards).
 */
function openSshTunnel(
  ssh: SshTunnelConfig,
  mysqlHost: string,
  mysqlPort: number,
): Promise<{ stream: Duplex; client: SshClient }> {
  return new Promise((resolve, reject) => {
    const client = new SshClient();

    client.on("ready", () => {
      client.forwardOut("127.0.0.1", 0, mysqlHost, mysqlPort, (err, stream) => {
        if (err) {
          client.end();
          reject(
            new Error(
              `SSH connected, but forwarding to MySQL at ${mysqlHost}:${mysqlPort} ` +
                `(as seen from the SSH server) failed: ${err.message}. ` +
                `Check the MySQL host/port are reachable from the SSH server.`,
            ),
          );
          return;
        }
        resolve({ stream, client });
      });
    });

    client.on("error", (err) => {
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    client.connect(buildSshConnectConfig(ssh));
  });
}

/** Build the ssh2 connect config (host/port/auth/host-key pinning) from our shape. */
function buildSshConnectConfig(ssh: SshTunnelConfig): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: ssh.host,
    port: ssh.port ?? DEFAULT_SSH_PORT,
    username: ssh.username,
  };

  if (ssh.auth.method === "password") {
    connectConfig.password = ssh.auth.password;
  } else {
    connectConfig.privateKey = ssh.auth.privateKey;
    if (ssh.auth.passphrase) connectConfig.passphrase = ssh.auth.passphrase;
  }

  // Optional host-key pinning.
  if (ssh.expectedHostKeySha256) {
    const expected = ssh.expectedHostKeySha256.replace(/:/g, "").toLowerCase();
    connectConfig.hostVerifier = (key: Buffer) => {
      const actual = createHash("sha256").update(key).digest("hex");
      return actual === expected;
    };
  }

  return connectConfig;
}

function normalizeFields(fields: unknown): QueryFieldMeta[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => {
    const field = f as { name: string; type?: number; table?: string };
    return { name: field.name, type: field.type, table: field.table };
  });
}

function validateSsh(ssh: SshTunnelConfig | undefined): void {
  if (!ssh) return;
  if (!ssh.host) throw new Error("ssh.host is required when using a tunnel.");
  if (!ssh.username) throw new Error("ssh.username is required when using a tunnel.");
  const auth = ssh.auth;
  if (!auth) throw new Error("ssh.auth is required when using a tunnel.");
  if (auth.method === "password" && !auth.password) {
    throw new Error("ssh.auth.password is required for password auth.");
  }
  if (auth.method === "privateKey" && !auth.privateKey) {
    throw new Error("ssh.auth.privateKey is required for key auth.");
  }
}

function validate(req: RunQueryRequest): void {
  if (!req || typeof req !== "object") throw new Error("Missing request body.");
  if (!req.connection?.host) throw new Error("connection.host is required.");
  if (!req.connection?.user) throw new Error("connection.user is required.");
  if (!req.query || !req.query.trim()) throw new Error("query is required.");
  validateSsh(req.ssh);
}

/**
 * Verify the SSH connection only: authenticate and reach the "ready" state, then
 * disconnect. Does NOT touch MySQL — no port-forward, no DB handshake. Use this to
 * confirm SSH host/credentials before adding the database host.
 */
export async function testSshTunnel(req: TestTunnelRequest): Promise<TestTunnelResult> {
  if (!req || typeof req !== "object") throw new Error("Missing request body.");
  if (!req.ssh) throw new Error("ssh is required to test the connection.");
  validateSsh(req.ssh);

  const ssh = req.ssh;
  const start = performance.now();

  await new Promise<void>((resolve, reject) => {
    const client = new SshClient();
    client.on("ready", () => {
      client.end();
      resolve();
    });
    client.on("error", (err) => {
      reject(new Error(`SSH connection failed: ${err.message}`));
    });
    client.connect(buildSshConnectConfig(ssh));
  });

  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    durationMs,
    message: `SSH connection established: ${ssh.username}@${ssh.host}:${ssh.port ?? DEFAULT_SSH_PORT}`,
  };
}

/**
 * Open a connection (optionally over an SSH tunnel), run a single query call,
 * and tear everything down. Stateless: every call connects fresh and closes.
 */
export async function runQuery(req: RunQueryRequest): Promise<RunQueryResult> {
  validate(req);

  const mysqlOptions = buildMysqlOptions(req.connection);
  let sshClient: SshClient | undefined;
  let connection: mysql.Connection | undefined;

  try {
    if (req.ssh) {
      const { stream, client } = await openSshTunnel(
        req.ssh,
        req.connection.host,
        req.connection.port ?? DEFAULT_MYSQL_PORT,
      );
      sshClient = client;
      // Hand mysql2 the tunneled stream instead of host/port.
      connection = await mysql.createConnection({ ...mysqlOptions, stream });
    } else {
      connection = await mysql.createConnection(mysqlOptions);
    }

    const start = performance.now();
    const [rows, fields] = await connection.query(req.query, req.params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      rows,
      fields: normalizeFields(fields),
      rowCount: Array.isArray(rows) ? rows.length : 0,
      durationMs,
      tunneled: Boolean(req.ssh),
    };
  } finally {
    if (connection) await connection.end().catch(() => {});
    if (sshClient) sshClient.end();
  }
}
