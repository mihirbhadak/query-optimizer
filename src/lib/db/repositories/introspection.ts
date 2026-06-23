/**
 * Synced schema metadata: db_tables / db_columns / db_indexes.
 *
 * `replaceSchema` swaps a database's entire stored structure in ONE transaction
 * (delete-then-insert). Deleting db_tables cascades to db_columns/db_indexes via
 * FK ON DELETE CASCADE. Because SQLite runs in WAL mode, readers keep seeing the
 * previous data until the transaction commits, so a re-sync never blocks reads or
 * exposes a half-written schema.
 */

import type { DbColumn, DbIndex, DbTable } from "@/types/db";

import { db } from "../client";
import { nowTs } from "./sync-jobs";

const bit = (v: boolean | undefined): 0 | 1 => (v ? 1 : 0);

export interface ColumnMetaInput {
  name: string;
  dataType?: string | null;
  columnType?: string | null;
  defaultValue?: string | null;
  isNullable?: boolean;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  charMaxLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  columnKey?: string | null;
  extra?: string | null;
  collation?: string | null;
  ordinal?: number | null;
  comment?: string | null;
}

export interface IndexMetaInput {
  name: string;
  isUnique?: boolean;
  isPrimary?: boolean;
  indexType?: string | null;
  /** Ordered list of participating columns. Serialized to JSON. */
  columns?: { name: string; subPart?: number | null; collation?: string | null }[];
  cardinality?: number | null;
  sizeBytes?: number;
  comment?: string | null;
}

export interface TableMetaInput {
  name: string;
  schemaName?: string | null;
  tableType?: string | null;
  engine?: string | null;
  rowCount?: number;
  sizeBytes?: number;
  dataSizeBytes?: number;
  indexSizeBytes?: number;
  dataFreeBytes?: number;
  autoIncrement?: number | null;
  collation?: string | null;
  tableComment?: string | null;
  columns: ColumnMetaInput[];
  indexes: IndexMetaInput[];
}

export interface SchemaSummary {
  tableCount: number;
  totalSizeBytes: number;
  totalRows: number;
  lastSyncAt: string | null;
}

export interface TableWithChildren {
  table: DbTable;
  columns: DbColumn[];
  indexes: DbIndex[];
}

export const introspectionRepository = {
  /** Atomically replace all stored tables/columns/indexes for a database. */
  replaceSchema(databaseId: number, tables: TableMetaInput[]): void {
    const ts = nowTs();

    const insertTable = db.prepare(
      `INSERT INTO db_tables (
         database_id, name, schema_name, table_type, engine, row_count, size_bytes,
         data_size_bytes, index_size_bytes, data_free_bytes, index_count, column_count,
         auto_increment, collation, table_comment, last_sync_at
       ) VALUES (
         @database_id, @name, @schema_name, @table_type, @engine, @row_count, @size_bytes,
         @data_size_bytes, @index_size_bytes, @data_free_bytes, @index_count, @column_count,
         @auto_increment, @collation, @table_comment, @last_sync_at
       )`,
    );
    const insertColumn = db.prepare(
      `INSERT INTO db_columns (
         db_table_id, name, data_type, column_type, default_value, is_nullable,
         is_primary_key, is_unique, is_indexed, char_max_length, numeric_precision,
         numeric_scale, column_key, extra, collation, ordinal, comment
       ) VALUES (
         @db_table_id, @name, @data_type, @column_type, @default_value, @is_nullable,
         @is_primary_key, @is_unique, @is_indexed, @char_max_length, @numeric_precision,
         @numeric_scale, @column_key, @extra, @collation, @ordinal, @comment
       )`,
    );
    const insertIndex = db.prepare(
      `INSERT INTO db_indexes (
         db_table_id, database_id, name, is_unique, is_primary, index_type, columns,
         column_count, cardinality, size_bytes, comment
       ) VALUES (
         @db_table_id, @database_id, @name, @is_unique, @is_primary, @index_type, @columns,
         @column_count, @cardinality, @size_bytes, @comment
       )`,
    );

    const swap = db.transaction((rows: TableMetaInput[]) => {
      // Cascades to db_columns + db_indexes (FK ON DELETE CASCADE).
      db.prepare("DELETE FROM db_tables WHERE database_id = ?").run(databaseId);

      for (const t of rows) {
        const info = insertTable.run({
          database_id: databaseId,
          name: t.name,
          schema_name: t.schemaName ?? null,
          table_type: t.tableType ?? null,
          engine: t.engine ?? null,
          row_count: t.rowCount ?? 0,
          size_bytes: t.sizeBytes ?? 0,
          data_size_bytes: t.dataSizeBytes ?? 0,
          index_size_bytes: t.indexSizeBytes ?? 0,
          data_free_bytes: t.dataFreeBytes ?? 0,
          index_count: t.indexes.length,
          column_count: t.columns.length,
          auto_increment: t.autoIncrement ?? null,
          collation: t.collation ?? null,
          table_comment: t.tableComment ?? null,
          last_sync_at: ts,
        });
        const tableId = Number(info.lastInsertRowid);

        for (const c of t.columns) {
          insertColumn.run({
            db_table_id: tableId,
            name: c.name,
            data_type: c.dataType ?? null,
            column_type: c.columnType ?? null,
            default_value: c.defaultValue ?? null,
            is_nullable: bit(c.isNullable),
            is_primary_key: bit(c.isPrimaryKey),
            is_unique: bit(c.isUnique),
            is_indexed: bit(c.isIndexed),
            char_max_length: c.charMaxLength ?? null,
            numeric_precision: c.numericPrecision ?? null,
            numeric_scale: c.numericScale ?? null,
            column_key: c.columnKey ?? null,
            extra: c.extra ?? null,
            collation: c.collation ?? null,
            ordinal: c.ordinal ?? null,
            comment: c.comment ?? null,
          });
        }

        for (const ix of t.indexes) {
          insertIndex.run({
            db_table_id: tableId,
            database_id: databaseId,
            name: ix.name,
            is_unique: bit(ix.isUnique),
            is_primary: bit(ix.isPrimary),
            index_type: ix.indexType ?? null,
            columns: ix.columns ? JSON.stringify(ix.columns) : null,
            column_count: ix.columns?.length ?? 0,
            cardinality: ix.cardinality ?? null,
            size_bytes: ix.sizeBytes ?? 0,
            comment: ix.comment ?? null,
          });
        }
      }
    });

    swap(tables);
  },

  getSummary(databaseId: number): SchemaSummary {
    const agg = db
      .prepare(
        `SELECT COUNT(*) AS tableCount,
                COALESCE(SUM(size_bytes), 0) AS totalSizeBytes,
                COALESCE(SUM(row_count), 0) AS totalRows
           FROM db_tables WHERE database_id = ?`,
      )
      .get(databaseId) as { tableCount: number; totalSizeBytes: number; totalRows: number };
    const last = db
      .prepare("SELECT last_sync_at FROM databases WHERE id = ?")
      .get(databaseId) as { last_sync_at: string | null } | undefined;
    return { ...agg, lastSyncAt: last?.last_sync_at ?? null };
  },

  listTables(databaseId: number): DbTable[] {
    return db
      .prepare("SELECT * FROM db_tables WHERE database_id = ? ORDER BY size_bytes DESC, name")
      .all(databaseId) as DbTable[];
  },

  getColumns(tableId: number): DbColumn[] {
    return db
      .prepare("SELECT * FROM db_columns WHERE db_table_id = ? ORDER BY ordinal, id")
      .all(tableId) as DbColumn[];
  },

  getIndexes(tableId: number): DbIndex[] {
    return db
      .prepare("SELECT * FROM db_indexes WHERE db_table_id = ? ORDER BY is_primary DESC, name")
      .all(tableId) as DbIndex[];
  },

  /** Full nested tree for the schema tab (tables -> columns + indexes). */
  getSchemaTree(databaseId: number): TableWithChildren[] {
    return this.listTables(databaseId).map((table) => ({
      table,
      columns: this.getColumns(table.id),
      indexes: this.getIndexes(table.id),
    }));
  },
};
