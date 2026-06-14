/**
 * Schema builder: `npm run db:build`.
 *
 * Compiles the table specs in ./schema/tables.ts into a single SQL file at
 * src/lib/db/schema.sql. Pass `--apply` to also (re)build the SQLite database
 * file from the generated SQL.
 *
 *   npm run db:build            # write schema.sql
 *   npm run db:build -- --apply # write schema.sql and apply it to the DB
 *   npm run db:build -- --reset # write schema.sql and REBUILD the DB (drops data)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSchemaSql } from "./schema/dsl";
import { tables } from "./schema/tables";

const SCHEMA_SQL_PATH = resolve("src/lib/db/schema.sql");

const sql = buildSchemaSql(tables);
writeFileSync(SCHEMA_SQL_PATH, sql, "utf8");
console.log(`Wrote ${tables.length} tables -> ${SCHEMA_SQL_PATH}`);

const reset = process.argv.includes("--reset");
if (reset || process.argv.includes("--apply")) {
  // Lazy import so plain `db:build` doesn't touch the database at all.
  void (async () => {
    const { applySchema, resetSchema } = await import("./client");
    if (reset) {
      resetSchema();
      console.log("Rebuilt the database (dropped + recreated all tables).");
    } else {
      applySchema();
      console.log("Applied schema to the database.");
    }
  })();
}
