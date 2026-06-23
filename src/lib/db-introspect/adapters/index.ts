/**
 * Engine adapter registry. MySQL/MariaDB are implemented; the interface is ready
 * for Postgres and others to drop in without touching the sync manager.
 */

import type { EngineAdapter } from "./types";
import { mysqlAdapter } from "./mysql";

export function getAdapter(engine: string): EngineAdapter {
  switch (engine) {
    case "mysql":
    case "mariadb":
      return mysqlAdapter;
    case "postgres":
    case "postgresql":
      throw new Error("Postgres introspection is not implemented yet.");
    default:
      throw new Error(`Unsupported database engine: ${engine}`);
  }
}

export type { EngineAdapter, IntrospectResult, RunFn, ProgressFn } from "./types";
