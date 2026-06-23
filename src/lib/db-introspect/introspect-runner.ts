/**
 * Opens a pooled connection to a saved database (direct or via SSH tunnel) and
 * exposes a bound read-only query runner for the adapters. Reuses ONE pooled
 * connection for every metadata query, then releases it.
 *
 * Bridges stored config -> live pool via databasesRepository.toRunnerOptions(id),
 * which decrypts secrets; secrets never leave the server.
 */

import { databasesRepository } from "@/lib/db";
import { closeConnection, ensureConnection, runQueryOn } from "@/lib/mysql-runner";

import type { RunFn } from "./adapters/types";

export interface IntrospectConnection {
  run: RunFn;
  close: () => Promise<void>;
}

export async function openIntrospectConnection(databaseId: number): Promise<IntrospectConnection> {
  const opts = databasesRepository.toRunnerOptions(databaseId);
  const info = await ensureConnection(opts);
  const connId = info.id;

  const run: RunFn = async (sql, params) => {
    const res = await runQueryOn(connId, sql, params, true);
    return res.rows as Record<string, unknown>[];
  };

  return {
    run,
    close: async () => {
      await closeConnection(connId).catch(() => {});
    },
  };
}
