/**
 * Tiny declarative schema DSL. Tables are described as plain data here, and the
 * builder (../build-schema.ts) compiles them into a single `schema.sql` file.
 * Edit the table specs in ./tables.ts and run `npm run db:build` to regenerate.
 *
 * Conventions baked in:
 *  - INTEGER PRIMARY KEY AUTOINCREMENT ids.
 *  - `timestamps: true` adds created_at/updated_at (TEXT, CURRENT_TIMESTAMP) plus
 *    an updated_at trigger.
 *  - enums become CHECK (col IN (...)); booleans are INTEGER with a 0/1 CHECK.
 *  - foreign keys are emitted as table-level constraints with ON DELETE actions.
 */

export type ColType = "int" | "text" | "bool" | "json" | "real" | "ts";
export type OnDelete = "cascade" | "set null" | "restrict" | "no action";

export interface Col {
  name: string;
  type: ColType;
  pk?: boolean;
  notNull?: boolean;
  unique?: boolean;
  /** Raw SQL default expression, e.g. "0", "'mysql'", "CURRENT_TIMESTAMP". */
  default?: string;
  /** Allowed values -> CHECK (name IN (...)). */
  enum?: readonly string[];
  /** Foreign key target. */
  ref?: { table: string; col?: string; onDelete?: OnDelete };
}

export interface Index {
  cols: string[];
  unique?: boolean;
}

export interface TableSpec {
  name: string;
  comment?: string;
  cols: Col[];
  /** Composite UNIQUE constraints. */
  unique?: string[][];
  indexes?: Index[];
  /** Add created_at/updated_at + updated_at trigger. */
  timestamps?: boolean;
}

// ---- helpers to keep table specs terse and readable ----

type Opts = Partial<Pick<Col, "notNull" | "unique" | "default" | "enum">>;

export const pk = (): Col => ({ name: "id", type: "int", pk: true });
export const text = (name: string, o: Opts = {}): Col => ({ name, type: "text", ...o });
export const int = (name: string, o: Opts = {}): Col => ({ name, type: "int", ...o });
export const real = (name: string, o: Opts = {}): Col => ({ name, type: "real", ...o });
export const bool = (name: string, o: Opts = {}): Col => ({ name, type: "bool", ...o });
export const json = (name: string, o: Opts = {}): Col => ({ name, type: "json", ...o });
export const ts = (name: string, o: Opts = {}): Col => ({ name, type: "ts", ...o });

export const enumText = (name: string, values: readonly string[], o: Opts = {}): Col => ({
  name,
  type: "text",
  enum: values,
  ...o,
});

export const fk = (
  name: string,
  table: string,
  o: { onDelete?: OnDelete; notNull?: boolean } = {},
): Col => ({
  name,
  type: "int",
  notNull: o.notNull ?? true,
  ref: { table, col: "id", onDelete: o.onDelete ?? "cascade" },
});

// ---- SQL emitter ----

const SQL_TYPE: Record<ColType, string> = {
  int: "INTEGER",
  text: "TEXT",
  bool: "INTEGER",
  // SQLite has no native JSON storage type — JSON is text validated with a
  // CHECK (see columnSql). The "JSON" type name documents intent in the DDL.
  json: "JSON",
  real: "REAL",
  ts: "TEXT",
};

function quote(values: readonly string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

function columnSql(c: Col): string {
  if (c.pk) return `${c.name} INTEGER PRIMARY KEY AUTOINCREMENT`;
  const parts = [c.name, SQL_TYPE[c.type]];
  if (c.notNull) parts.push("NOT NULL");
  if (c.unique) parts.push("UNIQUE");
  if (c.default !== undefined) parts.push(`DEFAULT ${c.default}`);
  if (c.enum) parts.push(`CHECK (${c.name} IN (${quote(c.enum)}))`);
  if (c.type === "bool") parts.push(`CHECK (${c.name} IN (0, 1))`);
  if (c.type === "json") parts.push(`CHECK (${c.name} IS NULL OR json_valid(${c.name}))`);
  return parts.join(" ");
}

/** Full column list for a table (including timestamp columns when enabled). */
function allCols(t: TableSpec): Col[] {
  const cols = [...t.cols];
  if (t.timestamps) {
    cols.push(ts("created_at", { notNull: true, default: "CURRENT_TIMESTAMP" }));
    cols.push(ts("updated_at", { notNull: true, default: "CURRENT_TIMESTAMP" }));
  }
  return cols;
}

/**
 * Column name + DDL fragment for each column of a table, used by the additive
 * migrator (../migrate.ts) to `ALTER TABLE ... ADD COLUMN` anything missing.
 */
export function tableColumnDefs(t: TableSpec): { name: string; def: string }[] {
  return allCols(t).map((c) => ({ name: c.name, def: columnSql(c) }));
}

function tableSql(t: TableSpec): string {
  const cols = allCols(t);

  const lines = cols.map(columnSql);

  for (const u of t.unique ?? []) lines.push(`UNIQUE (${u.join(", ")})`);

  for (const c of cols) {
    if (!c.ref) continue;
    const onDelete = c.ref.onDelete ? ` ON DELETE ${c.ref.onDelete.toUpperCase()}` : "";
    lines.push(`FOREIGN KEY (${c.name}) REFERENCES ${c.ref.table}(${c.ref.col ?? "id"})${onDelete}`);
  }

  const body = lines.map((l) => `  ${l}`).join(",\n");
  const header = t.comment ? `-- ${t.comment}\n` : "";
  return `${header}CREATE TABLE IF NOT EXISTS ${t.name} (\n${body}\n);`;
}

function indexesSql(t: TableSpec): string[] {
  const out: string[] = [];
  for (const ix of t.indexes ?? []) {
    const kind = ix.unique ? "UNIQUE INDEX" : "INDEX";
    const name = `${ix.unique ? "uix" : "ix"}_${t.name}_${ix.cols.join("_")}`;
    out.push(`CREATE ${kind} IF NOT EXISTS ${name} ON ${t.name} (${ix.cols.join(", ")});`);
  }
  return out;
}

function updatedAtTrigger(t: TableSpec): string | null {
  if (!t.timestamps) return null;
  return (
    `CREATE TRIGGER IF NOT EXISTS trg_${t.name}_updated_at\n` +
    `AFTER UPDATE ON ${t.name}\nFOR EACH ROW\nBEGIN\n` +
    `  UPDATE ${t.name} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;\nEND;`
  );
}

/** Compile all table specs into a single schema.sql string. */
export function buildSchemaSql(tables: TableSpec[]): string {
  const header = [
    "-- ============================================================",
    "-- Internal SQLite schema for query-optimizer.",
    "-- GENERATED by `npm run db:build` from src/lib/db/schema/tables.ts.",
    "-- Do not edit by hand — edit the table specs and rebuild.",
    "-- ============================================================",
    "",
    "PRAGMA foreign_keys = ON;",
    "",
  ].join("\n");

  const sections: string[] = [];
  for (const t of tables) {
    const chunk = [tableSql(t), ...indexesSql(t)];
    const trigger = updatedAtTrigger(t);
    if (trigger) chunk.push(trigger);
    sections.push(chunk.join("\n"));
  }

  return `${header}\n${sections.join("\n\n")}\n`;
}
