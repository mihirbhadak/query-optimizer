/**
 * Internal SQLite client (better-sqlite3, no ORM).
 *
 * A single connection is shared process-wide (and across Next.js dev hot-reloads).
 * On first open it sets pragmas and applies `schema.sql` (all `CREATE TABLE IF NOT
 * EXISTS`), so the schema is always present wherever the db is used.
 */

import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

import { DATABASE_PATH, SCHEMA_SQL_PATH } from "./paths";

export type Sqlite = Database.Database;

type Holder = { db?: Sqlite };
const globalRef = globalThis as unknown as { __internalDb?: Holder };
const holder: Holder = (globalRef.__internalDb ??= {});

function open(): Sqlite {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const sqlite = new Database(DATABASE_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

function create(): Sqlite {
  const sqlite = open();
  // Idempotent: every statement is CREATE ... IF NOT EXISTS.
  sqlite.exec(readFileSync(SCHEMA_SQL_PATH, "utf8"));
  holder.db = sqlite;
  return sqlite;
}

/** The shared better-sqlite3 connection (schema already applied). */
export const db: Sqlite = holder.db ?? create();

/** Re-apply schema.sql to the current database (used by `db:build --apply`). */
export function applySchema(): void {
  db.exec(readFileSync(SCHEMA_SQL_PATH, "utf8"));
}

/**
 * Drop every table then re-apply schema.sql — a clean dev rebuild for structural
 * changes (`CREATE IF NOT EXISTS` can't alter existing tables). DESTRUCTIVE:
 * deletes all data. Used by `db:build --reset`.
 */
export function resetSchema(): void {
  db.pragma("foreign_keys = OFF");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const drop = db.transaction(() => {
    for (const { name } of tables) db.exec(`DROP TABLE IF EXISTS "${name}"`);
  });
  drop();
  db.pragma("foreign_keys = ON");
  applySchema();
}

/** Close the connection (tests / graceful shutdown). */
export function closeDb(): void {
  holder.db?.close();
  holder.db = undefined;
}
