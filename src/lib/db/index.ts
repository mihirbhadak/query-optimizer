/**
 * Public entry point for the internal SQLite database.
 *
 * Application code should use the repositories (not the raw `db`), per the
 * architecture rule "database access only through repositories".
 *
 *   import { workspacesRepository, databasesRepository } from "@/lib/db";
 *
 * Repositories are provided for the core entities (workspaces, users, databases,
 * logs). Add more in ./repositories as features need them — every table exists in
 * the schema (see ./schema/tables.ts).
 */

export { db, closeDb, applySchema, type Sqlite } from "./client";
export { encryptSecret, decryptSecret, hasEncryptionKey } from "./crypto";

export { workspacesRepository } from "./repositories/workspaces";
export {
  workspaceMembersRepository,
  type WorkspaceMemberWithUser,
} from "./repositories/workspace-members";
export { usersRepository, type UserInput } from "./repositories/users";
export { rolesRepository, userRolesRepository } from "./repositories/roles";
export {
  databasesRepository,
  type DatabaseInput,
  type SafeDatabase,
} from "./repositories/databases";
export {
  userLogsRepository,
  systemLogsRepository,
  type UserLogEntry,
  type SystemLogEntry,
  type UserLogWithUser,
  type UserLogQuery,
  type SystemLogQuery,
} from "./repositories/logs";
export { settingsRepository } from "./repositories/settings";
export {
  introspectionRepository,
  type TableMetaInput,
  type ColumnMetaInput,
  type IndexMetaInput,
  type SchemaSummary,
  type TableWithChildren,
} from "./repositories/introspection";
export {
  syncJobsRepository,
  nowTs,
  type SyncJobPatch,
  type SyncJobDetailed,
} from "./repositories/sync-jobs";
