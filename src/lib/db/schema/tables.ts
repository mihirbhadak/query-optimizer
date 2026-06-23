/**
 * Relational schema for the internal SQLite database, modeling the entities in
 * docs/PROJECT_GUIDE.md. This is the SOURCE OF TRUTH — edit here and run
 * `npm run db:build` to regenerate ../schema.sql.
 *
 * Secret values (DB passwords, SSH keys, API keys) are stored encrypted in
 * `*_enc` columns (see ../crypto.ts); never store plaintext secrets.
 */

import { bool, enumText, fk, int, json, pk, type TableSpec, text, ts } from "./dsl";

const DB_ENGINES = ["mysql", "mariadb"] as const;
const SSL_MODES = ["disabled", "require", "require_no_verify"] as const;
const CONN_METHODS = ["direct", "ssh"] as const;
const SSH_AUTH = ["password", "privateKey"] as const;
const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
const INSTRUCTION_SCOPES = ["workspace", "database", "table", "column"] as const;
const AI_PROVIDERS = ["openai", "claude", "gemini", "openrouter"] as const;
const SUGGESTION_TYPES = [
  "add_index",
  "improve_instruction",
  "create_relation",
  "rename_column",
  "other",
] as const;
const SUGGESTION_STATUS = ["pending", "approved", "rejected", "implemented"] as const;
const RULE_ACTIONS = ["allow", "block"] as const;
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
const SYNC_STATUS = ["queued", "running", "success", "failed", "canceled"] as const;
const SYNC_TRIGGERS = ["manual", "auto", "startup"] as const;

export const tables: TableSpec[] = [
  // ---------------------------------------------------------------- users
  {
    name: "users",
    comment: "Application users.",
    timestamps: true,
    cols: [
      pk(),
      text("username", { notNull: true, unique: true }),
      text("first_name"),
      text("last_name"),
      text("email", { notNull: true, unique: true }),
      // Store a password HASH (e.g. bcrypt/argon2) — never plaintext.
      text("password"),
      // pending = awaiting admin approval; active = approved/default (can log in);
      // rejected = signup denied; deleted = soft-deleted. Only "active" can log in.
      enumText("status", ["pending", "active", "rejected", "deleted"], {
        notNull: true,
        default: "'active'",
      }),
    ],
  },

  // --------------------------------------------------------------- roles
  {
    name: "roles",
    comment: "Named roles with a permissions set (JSON).",
    cols: [
      pk(),
      text("name", { notNull: true, unique: true }),
      text("description"),
      json("permissions"),
    ],
  },

  // ------------------------------------------------------------- settings
  {
    name: "settings",
    comment: "App-level key/value settings (admin-configurable).",
    timestamps: true,
    cols: [pk(), text("key", { notNull: true, unique: true }), json("value")],
  },

  // ---------------------------------------------------------- workspaces
  {
    name: "workspaces",
    comment: "A company / team / client / project.",
    timestamps: true,
    cols: [
      pk(),
      text("name", { notNull: true }),
      text("slug", { notNull: true, unique: true }),
      text("description"),
    ],
  },

  // ------------------------------------------------------ workspace_members
  {
    name: "workspace_members",
    comment: "Per-workspace user authorization (which users may access a workspace + role).",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      fk("user_id", "users"),
      enumText("role", WORKSPACE_ROLES, { notNull: true, default: "'member'" }),
    ],
    unique: [["workspace_id", "user_id"]],
    indexes: [{ cols: ["workspace_id"] }, { cols: ["user_id"] }],
  },

  // --------------------------------------------------------- user_roles
  {
    name: "user_roles",
    comment: "Assigns a role to a user, with optional per-assignment overrides.",
    timestamps: true,
    cols: [
      pk(),
      fk("user_id", "users"),
      fk("role_id", "roles"),
      json("custom_permissions"),
    ],
    unique: [["user_id", "role_id"]],
    indexes: [{ cols: ["user_id"] }],
  },

  // ----------------------------------------------------------- databases
  {
    name: "databases",
    comment: "Customer database connections (consumed by the mysql-runner).",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      text("name", { notNull: true }),
      enumText("engine", DB_ENGINES, { notNull: true, default: "'mysql'" }),
      text("host", { notNull: true }),
      int("port", { notNull: true, default: "3306" }),
      text("username", { notNull: true }),
      text("password_enc"),
      text("db_name"),
      enumText("ssl_mode", SSL_MODES, { notNull: true, default: "'disabled'" }),
      enumText("connection_method", CONN_METHODS, { notNull: true, default: "'direct'" }),
      // SSH tunnel (used when connection_method = 'ssh')
      text("ssh_host"),
      int("ssh_port", { default: "22" }),
      text("ssh_username"),
      enumText("ssh_auth_method", SSH_AUTH),
      text("ssh_password_enc"),
      text("ssh_private_key_enc"),
      text("ssh_passphrase_enc"),
      ts("last_sync_at"),
    ],
    unique: [["workspace_id", "name"]],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ----------------------------------------------------------- db_tables
  {
    name: "db_tables",
    comment: "Synced table metadata for a database (structure only, no customer data).",
    timestamps: true,
    cols: [
      pk(),
      fk("database_id", "databases"),
      text("name", { notNull: true }),
      text("schema_name"),
      text("table_type"),
      // Storage engine (InnoDB/MyISAM/...) — distinct from the connection's db engine.
      text("engine"),
      // Estimated row count from the dictionary (information_schema) — never COUNT(*).
      int("row_count", { default: "0" }),
      int("size_bytes", { default: "0" }), // total = data + index
      int("data_size_bytes", { default: "0" }),
      int("index_size_bytes", { default: "0" }),
      int("data_free_bytes", { default: "0" }),
      int("index_count", { default: "0" }),
      int("column_count", { default: "0" }),
      int("auto_increment"),
      text("collation"),
      text("table_comment"),
      text("description"),
      ts("last_sync_at"),
    ],
    unique: [["database_id", "name"]],
    indexes: [{ cols: ["database_id"] }],
  },

  // ---------------------------------------------------------- db_columns
  {
    name: "db_columns",
    comment: "Synced column metadata for a table.",
    timestamps: true,
    cols: [
      pk(),
      fk("db_table_id", "db_tables"),
      text("name", { notNull: true }),
      // data_type = base type (e.g. "varchar"); column_type = full (e.g. "varchar(255)").
      text("data_type"),
      text("column_type"),
      text("default_value"),
      bool("is_nullable", { default: "1" }),
      bool("is_primary_key", { default: "0" }),
      bool("is_unique", { default: "0" }),
      bool("is_indexed", { default: "0" }),
      int("char_max_length"),
      int("numeric_precision"),
      int("numeric_scale"),
      text("column_key"),
      text("extra"),
      text("collation"),
      int("ordinal"),
      text("comment"),
      text("description"),
    ],
    unique: [["db_table_id", "name"]],
    indexes: [{ cols: ["db_table_id"] }],
  },

  // ---------------------------------------------------------- db_indexes
  {
    name: "db_indexes",
    comment: "Synced index metadata for a table (with per-index size when available).",
    timestamps: true,
    cols: [
      pk(),
      fk("db_table_id", "db_tables"),
      // Denormalized for easy per-database querying by the AI optimizer.
      fk("database_id", "databases"),
      text("name", { notNull: true }),
      bool("is_unique", { default: "0" }),
      bool("is_primary", { default: "0" }),
      text("index_type"),
      // Ordered list of { name, sub_part, collation }.
      json("columns"),
      int("column_count", { default: "0" }),
      int("cardinality"),
      int("size_bytes", { default: "0" }),
      text("comment"),
    ],
    unique: [["db_table_id", "name"]],
    indexes: [{ cols: ["db_table_id"] }, { cols: ["database_id"] }],
  },

  // -------------------------------------------------------- db_sync_jobs
  {
    name: "db_sync_jobs",
    comment: "Schema-introspection runs: queue, progress, timing, and per-run metadata.",
    timestamps: true,
    cols: [
      pk(),
      fk("database_id", "databases"),
      enumText("status", SYNC_STATUS, { notNull: true, default: "'queued'" }),
      text("phase"),
      int("progress", { default: "0" }),
      int("tables_total", { default: "0" }),
      int("tables_done", { default: "0" }),
      text("engine"),
      text("engine_version"),
      int("table_count"),
      int("total_size_bytes"),
      text("error"),
      enumText("trigger", SYNC_TRIGGERS, { notNull: true, default: "'manual'" }),
      fk("requested_by", "users", { onDelete: "set null", notNull: false }),
      ts("started_at"),
      ts("finished_at"),
      int("duration_ms"),
    ],
    indexes: [{ cols: ["database_id"] }, { cols: ["status"] }, { cols: ["created_at"] }],
  },

  // -------------------------------------------------------- instructions
  {
    name: "instructions",
    comment: "Business context for the AI, scoped at several levels.",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      enumText("scope", INSTRUCTION_SCOPES, { notNull: true }),
      fk("database_id", "databases", { onDelete: "set null", notNull: false }),
      fk("db_table_id", "db_tables", { onDelete: "set null", notNull: false }),
      text("target_column"),
      text("content", { notNull: true }),
      fk("created_by", "users", { onDelete: "set null", notNull: false }),
    ],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ------------------------------------------------------------ env_keys
  {
    name: "env_keys",
    comment: "Encrypted API keys / secrets (e.g. AI provider keys).",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      text("name", { notNull: true }),
      enumText("provider", [...AI_PROVIDERS, "other"]),
      text("key_enc", { notNull: true }),
    ],
    unique: [["workspace_id", "name"]],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // -------------------------------------------------------------- agents
  {
    name: "agents",
    comment: "Configured AI agents (provider + model + prompt).",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      text("name", { notNull: true }),
      enumText("provider", AI_PROVIDERS, { notNull: true }),
      text("model"),
      fk("env_key_id", "env_keys", { onDelete: "set null", notNull: false }),
      text("system_prompt"),
      json("config"),
      bool("is_default", { notNull: true, default: "0" }),
    ],
    unique: [["workspace_id", "name"]],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ---------------------------------------------------------------- chat
  {
    name: "chat",
    comment: "A conversation thread.",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      fk("user_id", "users", { onDelete: "set null", notNull: false }),
      fk("database_id", "databases", { onDelete: "set null", notNull: false }),
      text("title"),
    ],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ------------------------------------------------------- chat_messages
  {
    name: "chat_messages",
    comment: "Messages within a chat, with any generated SQL.",
    cols: [
      pk(),
      fk("chat_id", "chat"),
      enumText("role", ["user", "assistant", "system"], { notNull: true }),
      text("content", { notNull: true }),
      text("generated_sql"),
      json("metadata"),
      ts("created_at", { notNull: true, default: "CURRENT_TIMESTAMP" }),
    ],
    indexes: [{ cols: ["chat_id"] }],
  },

  // --------------------------------------------------------- suggestions
  {
    name: "suggestions",
    comment: "User suggestions (add index, improve instruction, ...).",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      fk("user_id", "users", { onDelete: "set null", notNull: false }),
      fk("database_id", "databases", { onDelete: "set null", notNull: false }),
      enumText("type", SUGGESTION_TYPES, { notNull: true }),
      text("title", { notNull: true }),
      text("body"),
      enumText("status", SUGGESTION_STATUS, { notNull: true, default: "'pending'" }),
    ],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ------------------------------------------------------------ metadata
  {
    name: "metadata",
    comment: "Generic key/value metadata attached to any entity.",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces", { onDelete: "cascade", notNull: false }),
      text("entity_type", { notNull: true }),
      int("entity_id"),
      text("key", { notNull: true }),
      json("value"),
    ],
    unique: [["entity_type", "entity_id", "key"]],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // --------------------------------------------------------- query_rules
  {
    name: "query_rules",
    comment: "Query-safety rules: allow/block statement types per workspace/db.",
    timestamps: true,
    cols: [
      pk(),
      fk("workspace_id", "workspaces"),
      fk("database_id", "databases", { onDelete: "cascade", notNull: false }),
      text("statement_type", { notNull: true }),
      enumText("action", RULE_ACTIONS, { notNull: true }),
      bool("enabled", { notNull: true, default: "1" }),
    ],
    unique: [["workspace_id", "database_id", "statement_type"]],
    indexes: [{ cols: ["workspace_id"] }],
  },

  // ----------------------------------------------------------- user_logs
  {
    name: "user_logs",
    comment: "Append-only audit of user actions.",
    cols: [
      pk(),
      fk("workspace_id", "workspaces", { onDelete: "set null", notNull: false }),
      fk("user_id", "users", { onDelete: "set null", notNull: false }),
      text("action", { notNull: true }),
      text("target_type"),
      text("target_id"),
      text("ip_address"),
      json("metadata"),
      ts("created_at", { notNull: true, default: "CURRENT_TIMESTAMP" }),
    ],
    indexes: [{ cols: ["workspace_id"] }, { cols: ["user_id"] }, { cols: ["created_at"] }],
  },

  // --------------------------------------------------------- system_logs
  {
    name: "system_logs",
    comment: "Append-only system events / errors.",
    cols: [
      pk(),
      enumText("level", LOG_LEVELS, { notNull: true, default: "'info'" }),
      text("source"),
      text("message", { notNull: true }),
      json("metadata"),
      ts("created_at", { notNull: true, default: "CURRENT_TIMESTAMP" }),
    ],
    indexes: [{ cols: ["level"] }, { cols: ["created_at"] }],
  },
];
