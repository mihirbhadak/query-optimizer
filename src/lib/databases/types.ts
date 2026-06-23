// DB-free types/constants — safe to import from client components.

import type { ConnectionMethod, DbEngine, SshAuthMethod, SslMode } from "@/types/db";

/** Plaintext connection details used by the create form and the test actions. */
export interface ConnectionConfig {
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  username: string;
  password?: string;
  dbName?: string;
  sslMode: SslMode;
  connectionMethod: ConnectionMethod;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshAuthMethod?: SshAuthMethod;
  sshPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
  durationMs?: number;
}

export const DB_ENGINES: DbEngine[] = ["mysql", "mariadb"];
export const SSL_MODES: SslMode[] = ["disabled", "require", "require_no_verify"];
export const SSH_AUTH_METHODS: SshAuthMethod[] = ["password", "privateKey"];
