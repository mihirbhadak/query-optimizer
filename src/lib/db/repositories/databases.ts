import type { OpenConnectionOptions } from "@/lib/mysql-runner";
import type { ConnectionMethod, DatabaseRow, DbEngine, SshAuthMethod, SslMode } from "@/types/db";

import { db } from "../client";
import { decryptOptional, encryptOptional } from "../crypto";

/** Plaintext input for creating a database connection (secrets get encrypted). */
export interface DatabaseInput {
  workspaceId: number;
  name: string;
  engine?: DbEngine;
  host: string;
  port?: number;
  username: string;
  password?: string;
  dbName?: string;
  sslMode?: SslMode;
  connectionMethod?: ConnectionMethod;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshAuthMethod?: SshAuthMethod;
  sshPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}

/** A connection row with all `*_enc` secrets stripped — safe to return to clients. */
export type SafeDatabase = Omit<
  DatabaseRow,
  "password_enc" | "ssh_password_enc" | "ssh_private_key_enc" | "ssh_passphrase_enc"
> & { has_password: boolean; has_ssh_secret: boolean };

function toSafe(row: DatabaseRow): SafeDatabase {
  const { password_enc, ssh_password_enc, ssh_private_key_enc, ssh_passphrase_enc, ...rest } = row;
  return {
    ...rest,
    has_password: Boolean(password_enc),
    has_ssh_secret: Boolean(ssh_password_enc || ssh_private_key_enc),
  };
}

function sslToConfig(mode: SslMode): OpenConnectionOptions["connection"]["ssl"] {
  if (mode === "require") return true;
  if (mode === "require_no_verify") return { rejectUnauthorized: false };
  return undefined;
}

/**
 * Database-connection data access. Secrets are encrypted on write and decrypted
 * only when building runner options — never exposed via list/get.
 */
export const databasesRepository = {
  create(input: DatabaseInput): SafeDatabase {
    const info = db
      .prepare(
        `INSERT INTO databases (
           workspace_id, name, engine, host, port, username, password_enc, db_name,
           ssl_mode, connection_method, ssh_host, ssh_port, ssh_username, ssh_auth_method,
           ssh_password_enc, ssh_private_key_enc, ssh_passphrase_enc
         ) VALUES (
           @workspace_id, @name, @engine, @host, @port, @username, @password_enc, @db_name,
           @ssl_mode, @connection_method, @ssh_host, @ssh_port, @ssh_username, @ssh_auth_method,
           @ssh_password_enc, @ssh_private_key_enc, @ssh_passphrase_enc
         )`,
      )
      .run({
        workspace_id: input.workspaceId,
        name: input.name,
        engine: input.engine ?? "mysql",
        host: input.host,
        port: input.port ?? 3306,
        username: input.username,
        password_enc: encryptOptional(input.password),
        db_name: input.dbName ?? null,
        ssl_mode: input.sslMode ?? "disabled",
        connection_method: input.connectionMethod ?? (input.sshHost ? "ssh" : "direct"),
        ssh_host: input.sshHost ?? null,
        ssh_port: input.sshPort ?? 22,
        ssh_username: input.sshUsername ?? null,
        ssh_auth_method: input.sshAuthMethod ?? null,
        ssh_password_enc: encryptOptional(input.sshPassword),
        ssh_private_key_enc: encryptOptional(input.sshPrivateKey),
        ssh_passphrase_enc: encryptOptional(input.sshPassphrase),
      });
    return this.getSafe(Number(info.lastInsertRowid))!;
  },

  /** Internal: full row incl. ciphertext. Prefer getSafe / toRunnerOptions. */
  getRow(id: number): DatabaseRow | undefined {
    return db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DatabaseRow | undefined;
  },

  getSafe(id: number): SafeDatabase | undefined {
    const row = this.getRow(id);
    return row ? toSafe(row) : undefined;
  },

  getByName(workspaceId: number, name: string): SafeDatabase | undefined {
    const row = db
      .prepare("SELECT * FROM databases WHERE workspace_id = ? AND name = ?")
      .get(workspaceId, name) as DatabaseRow | undefined;
    return row ? toSafe(row) : undefined;
  },

  /**
   * Patch a connection. Non-secret columns are set when provided; secret fields
   * (`password`, `ssh*`) are re-encrypted only when a new plaintext value is
   * given — pass them undefined to keep the existing secret.
   */
  update(id: number, input: Partial<DatabaseInput>): SafeDatabase | undefined {
    const u: Record<string, unknown> = {};
    const cols: [keyof DatabaseInput, string][] = [
      ["name", "name"],
      ["engine", "engine"],
      ["host", "host"],
      ["port", "port"],
      ["username", "username"],
      ["dbName", "db_name"],
      ["sslMode", "ssl_mode"],
      ["connectionMethod", "connection_method"],
      ["sshHost", "ssh_host"],
      ["sshPort", "ssh_port"],
      ["sshUsername", "ssh_username"],
      ["sshAuthMethod", "ssh_auth_method"],
    ];
    for (const [k, col] of cols) if (input[k] !== undefined) u[col] = input[k];
    if (input.password !== undefined) u.password_enc = encryptOptional(input.password);
    if (input.sshPassword !== undefined) u.ssh_password_enc = encryptOptional(input.sshPassword);
    if (input.sshPrivateKey !== undefined) u.ssh_private_key_enc = encryptOptional(input.sshPrivateKey);
    if (input.sshPassphrase !== undefined) u.ssh_passphrase_enc = encryptOptional(input.sshPassphrase);

    const entries = Object.entries(u);
    if (entries.length > 0) {
      const set = entries.map(([k]) => `${k} = @${k}`).join(", ");
      db.prepare(`UPDATE databases SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run({
        ...Object.fromEntries(entries),
        id,
      });
    }
    return this.getSafe(id);
  },

  list(workspaceId: number): SafeDatabase[] {
    return (
      db.prepare("SELECT * FROM databases WHERE workspace_id = ? ORDER BY name").all(workspaceId) as
      DatabaseRow[]
    ).map(toSafe);
  },

  delete(id: number): void {
    db.prepare("DELETE FROM databases WHERE id = ?").run(id);
  },

  /** Stamp last_sync_at after a successful schema sync. */
  markSynced(id: number): void {
    db.prepare("UPDATE databases SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  },

  /**
   * Decrypt stored secrets and build options for the mysql-runner
   * (`runQuery`/`ensureConnection`). The bridge from stored config to a live pool.
   */
  toRunnerOptions(id: number): OpenConnectionOptions {
    const row = this.getRow(id);
    if (!row) throw new Error(`No database connection with id ${id}.`);

    const opts: OpenConnectionOptions = {
      connection: {
        host: row.host,
        port: row.port,
        user: row.username,
        password: decryptOptional(row.password_enc),
        database: row.db_name ?? undefined,
        ssl: sslToConfig(row.ssl_mode),
      },
      label: row.name,
    };

    if (row.connection_method === "ssh" && row.ssh_host && row.ssh_username && row.ssh_auth_method) {
      opts.ssh = {
        host: row.ssh_host,
        port: row.ssh_port ?? 22,
        username: row.ssh_username,
        auth:
          row.ssh_auth_method === "password"
            ? { method: "password", password: decryptOptional(row.ssh_password_enc) ?? "" }
            : {
                method: "privateKey",
                privateKey: decryptOptional(row.ssh_private_key_enc) ?? "",
                passphrase: decryptOptional(row.ssh_passphrase_enc),
              },
      };
    }

    return opts;
  },
};
