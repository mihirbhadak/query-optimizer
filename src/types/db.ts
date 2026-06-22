/**
 * Shared row types for the internal database. These mirror the SQL schema in
 * src/lib/db/schema/tables.ts. Booleans are stored as 0/1 integers and JSON
 * columns as TEXT; repositories handle any conversion.
 */

export type DbEngine = "mysql" | "mariadb";
export type SslMode = "disabled" | "require" | "require_no_verify";
export type ConnectionMethod = "direct" | "ssh";
export type SshAuthMethod = "password" | "privateKey";
export type InstructionScope = "workspace" | "database" | "table" | "column";
export type AiProvider = "openai" | "claude" | "gemini" | "openrouter";
export type SuggestionStatus = "pending" | "approved" | "rejected" | "implemented";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface User {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  /** Password hash (never plaintext). */
  password: string | null;
  status: "pending" | "active" | "rejected" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  /** JSON-encoded permissions set. */
  permissions: string | null;
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  /** JSON-encoded per-assignment permission overrides. */
  custom_permissions: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseRow {
  id: number;
  workspace_id: number;
  name: string;
  engine: DbEngine;
  host: string;
  port: number;
  username: string;
  password_enc: string | null;
  db_name: string | null;
  ssl_mode: SslMode;
  connection_method: ConnectionMethod;
  ssh_host: string | null;
  ssh_port: number | null;
  ssh_username: string | null;
  ssh_auth_method: SshAuthMethod | null;
  ssh_password_enc: string | null;
  ssh_private_key_enc: string | null;
  ssh_passphrase_enc: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTable {
  id: number;
  database_id: number;
  name: string;
  engine: string | null;
  row_count: number;
  size_bytes: number;
  index_count: number;
  description: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbColumn {
  id: number;
  db_table_id: number;
  name: string;
  data_type: string | null;
  is_nullable: number;
  is_primary_key: number;
  is_indexed: number;
  ordinal: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Instruction {
  id: number;
  workspace_id: number;
  scope: InstructionScope;
  database_id: number | null;
  db_table_id: number | null;
  target_column: string | null;
  content: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface EnvKey {
  id: number;
  workspace_id: number;
  name: string;
  provider: AiProvider | "other" | null;
  key_enc: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: number;
  workspace_id: number;
  name: string;
  provider: AiProvider;
  model: string | null;
  env_key_id: number | null;
  system_prompt: string | null;
  config: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: number;
  workspace_id: number;
  user_id: number | null;
  database_id: number | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  chat_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  generated_sql: string | null;
  metadata: string | null;
  created_at: string;
}

export interface Suggestion {
  id: number;
  workspace_id: number;
  user_id: number | null;
  database_id: number | null;
  type: "add_index" | "improve_instruction" | "create_relation" | "rename_column" | "other";
  title: string;
  body: string | null;
  status: SuggestionStatus;
  created_at: string;
  updated_at: string;
}

export interface Metadata {
  id: number;
  workspace_id: number | null;
  entity_type: string;
  entity_id: number | null;
  key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueryRule {
  id: number;
  workspace_id: number;
  database_id: number | null;
  statement_type: string;
  action: "allow" | "block";
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface UserLog {
  id: number;
  workspace_id: number | null;
  user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  metadata: string | null;
  created_at: string;
}

export interface SystemLog {
  id: number;
  level: LogLevel;
  source: string | null;
  message: string;
  metadata: string | null;
  created_at: string;
}
