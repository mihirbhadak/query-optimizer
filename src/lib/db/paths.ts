import { resolve } from "node:path";

/**
 * Filesystem location of the internal SQLite database. Override with
 * DATABASE_PATH (relative to the project root, or absolute). Defaults to
 * `.data/app.db`, which is gitignored.
 *
 * Kept dependency-free so the app, the builder, and test scripts can all import it.
 */
export const DATABASE_PATH = resolve(process.env.DATABASE_PATH ?? ".data/app.db");

/** The generated DDL applied at startup to build/upgrade the schema. */
export const SCHEMA_SQL_PATH = resolve("src/lib/db/schema.sql");
