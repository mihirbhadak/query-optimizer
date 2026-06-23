/**
 * Additive, non-destructive schema migration: `npm run db:migrate`.
 *
 * `schema.sql` is all `CREATE TABLE IF NOT EXISTS`, so it creates NEW tables but
 * never alters existing ones. This brings an existing database up to date with
 * the current table specs WITHOUT dropping data:
 *   1. applySchema()  -> create any newly added tables.
 *   2. For every table that already exists, ADD COLUMN for any column present in
 *      the spec but missing from the live table.
 *
 * It never drops or rewrites tables, so real data (users, workspaces, databases)
 * is preserved. Use this instead of `db:build --reset` (which is destructive).
 */

import { applySchema, db } from "./client";
import { tableColumnDefs } from "./schema/dsl";
import { tables } from "./schema/tables";

function run(): void {
  // 1. Create any tables that don't exist yet (idempotent).
  applySchema();

  // 2. Add missing columns to existing tables.
  const added: string[] = [];
  const addColumns = db.transaction(() => {
    for (const spec of tables) {
      const info = db.pragma(`table_info(${spec.name})`) as { name: string }[];
      if (info.length === 0) continue; // brand-new table: applySchema already made it whole.
      const have = new Set(info.map((c) => c.name));
      for (const { name, def } of tableColumnDefs(spec)) {
        if (have.has(name)) continue;
        db.exec(`ALTER TABLE ${spec.name} ADD COLUMN ${def}`);
        added.push(`${spec.name}.${name}`);
      }
    }
  });
  addColumns();

  console.log(
    added.length > 0
      ? `Migrated: added ${added.length} column(s): ${added.join(", ")}`
      : "Schema already up to date — no changes.",
  );
}

run();
