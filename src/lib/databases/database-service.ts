/**
 * DatabaseService — workspace database connections: CRUD plus "test tunnel" and
 * "test connection" against unsaved form input. Secrets are encrypted by the
 * repository; tests build configs on the fly and never persist anything.
 */

import { databasesRepository, type DatabaseInput, type SafeDatabase } from "@/lib/db";
import { acquireTunnel, type SshConfig } from "@/lib/ssh-tunnel";
import { runQuery, closeConnection, type OpenConnectionOptions } from "@/lib/mysql-runner";
import { userLogService } from "@/lib/users";
import type { SslMode } from "@/types/db";

import type { ConnectionConfig, TestResult } from "./types";

export interface Actor {
  actorId?: number;
}

export class DatabaseServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseServiceError";
  }
}

function sslToConfig(mode: SslMode): OpenConnectionOptions["connection"]["ssl"] {
  if (mode === "require") return true;
  if (mode === "require_no_verify") return { rejectUnauthorized: false };
  return undefined;
}

function buildSsh(c: ConnectionConfig): SshConfig | undefined {
  if (c.connectionMethod !== "ssh" || !c.sshHost || !c.sshUsername || !c.sshAuthMethod) {
    return undefined;
  }
  return {
    host: c.sshHost,
    port: c.sshPort ?? 22,
    username: c.sshUsername,
    auth:
      c.sshAuthMethod === "password"
        ? { method: "password", password: c.sshPassword ?? "" }
        : { method: "privateKey", privateKey: c.sshPrivateKey ?? "", passphrase: c.sshPassphrase || undefined },
  };
}

function buildRunnerOptions(c: ConnectionConfig): OpenConnectionOptions {
  return {
    connection: {
      host: c.host,
      port: c.port || 3306,
      user: c.username,
      password: c.password,
      database: c.dbName || undefined,
      ssl: sslToConfig(c.sslMode),
    },
    ssh: buildSsh(c),
    label: c.name || c.host,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export class DatabaseService {
  list(workspaceId: number): SafeDatabase[] {
    return databasesRepository.list(workspaceId);
  }

  get(id: number): SafeDatabase | undefined {
    return databasesRepository.getSafe(id);
  }

  getByName(workspaceId: number, name: string): SafeDatabase | undefined {
    return databasesRepository.getByName(workspaceId, name);
  }

  create(input: DatabaseInput, actor: Actor = {}): SafeDatabase {
    if (!input.name?.trim()) throw new DatabaseServiceError("Name is required.");
    if (!input.host?.trim()) throw new DatabaseServiceError("Host is required.");
    if (!input.username?.trim()) throw new DatabaseServiceError("Database user is required.");
    let row: SafeDatabase;
    try {
      row = databasesRepository.create(input);
    } catch (err) {
      if (errorMessage(err, "").includes("UNIQUE")) {
        throw new DatabaseServiceError(`A database named "${input.name}" already exists in this workspace.`);
      }
      throw err;
    }
    userLogService.record("database.create", {
      actorId: actor.actorId,
      metadata: { workspaceId: input.workspaceId, name: input.name },
    });
    return row;
  }

  update(id: number, input: ConnectionConfig, actor: Actor = {}): SafeDatabase {
    if (!input.name?.trim()) throw new DatabaseServiceError("Name is required.");
    if (!input.host?.trim()) throw new DatabaseServiceError("Host is required.");
    if (!input.username?.trim()) throw new DatabaseServiceError("Database user is required.");
    let row: SafeDatabase | undefined;
    try {
      row = databasesRepository.update(id, input);
    } catch (err) {
      if (errorMessage(err, "").includes("UNIQUE")) {
        throw new DatabaseServiceError(`A database named "${input.name}" already exists in this workspace.`);
      }
      throw err;
    }
    if (!row) throw new DatabaseServiceError("Database not found.");
    userLogService.record("database.update", {
      actorId: actor.actorId,
      metadata: { databaseId: id, name: input.name },
    });
    return row;
  }

  delete(id: number, actor: Actor = {}): void {
    const existing = databasesRepository.getSafe(id);
    databasesRepository.delete(id);
    userLogService.record("database.delete", {
      actorId: actor.actorId,
      metadata: { databaseId: id, name: existing?.name },
    });
  }

  /** Verify the SSH tunnel (auth + connectivity). Does not touch the database. */
  async testTunnel(c: ConnectionConfig): Promise<TestResult> {
    const ssh = buildSsh(c);
    if (!ssh) return { ok: false, message: "SSH tunnel is not enabled or its settings are incomplete." };
    const start = Date.now();
    let handle;
    try {
      handle = await acquireTunnel({ ssh, target: { host: c.host, port: c.port || 3306 } });
      return {
        ok: true,
        message: `SSH connection established to ${ssh.username}@${ssh.host}:${ssh.port}.`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return { ok: false, message: errorMessage(err, "Tunnel test failed.") };
    } finally {
      await handle?.release().catch(() => {});
    }
  }

  /** Full end-to-end connection test (through SSH if configured). */
  async testConnection(c: ConnectionConfig): Promise<TestResult> {
    const opts = buildRunnerOptions(c);
    const start = Date.now();
    let connectionId: string | undefined;
    try {
      const result = await runQuery({ ...opts, query: "SELECT VERSION() AS version", readOnly: true });
      connectionId = result.connectionId;
      const version = (result.rows as { version?: string }[])[0]?.version ?? "unknown";
      return {
        ok: true,
        message: `Connected — server version ${version}${result.tunneled ? " (via SSH tunnel)" : ""}.`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return { ok: false, message: errorMessage(err, "Connection test failed.") };
    } finally {
      if (connectionId) await closeConnection(connectionId).catch(() => {});
    }
  }
}

export const databaseService = new DatabaseService();
