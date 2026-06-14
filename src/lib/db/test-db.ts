/**
 * Smoke test for the internal SQLite setup: `npm run test:internal-db`.
 *
 * Exercises schema application (from schema.sql), the repositories, secret
 * encryption round-trip, and the bridge to mysql-runner options. Uses a temp DB
 * file so it never touches your real `.data/app.db`.
 */

import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

// Configure a throwaway DB + encryption key BEFORE importing the client.
const TMP_DB = resolve(`.data/test-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP_DB;
process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");

async function main() {
  const {
    workspacesRepository,
    usersRepository,
    rolesRepository,
    userRolesRepository,
    databasesRepository,
    userLogsRepository,
    systemLogsRepository,
    closeDb,
    db,
  } = await import("./index");

  console.log("Applying schema.sql + writing via repositories...");

  const tableCount = (
    db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get() as { n: number }
  ).n;
  console.log("  tables in db:", tableCount);

  const ws = workspacesRepository.create({ name: "AllEvents", slug: `ae-${Date.now()}` });
  const user = usersRepository.create({
    username: "mihir",
    firstName: "Mihir",
    lastName: "Bhadak",
    email: "navghan@allevents.in",
    password: "hashed-pw-placeholder",
  });
  const role = rolesRepository.create({
    name: "owner",
    description: "Full access",
    permissions: { "*": true },
  });
  const assignment = userRolesRepository.assign(user.id, role.id, { databases: ["read", "write"] });
  const userRoles = userRolesRepository.rolesForUser(user.id);
  console.log(
    `  workspace #${ws.id}, user @${user.username} (#${user.id}), role=${role.name}` +
      `, assignment#${assignment.id}, rolesForUser=${userRoles.map((r) => r.name).join(",")}`,
  );

  const conn = databasesRepository.create({
    workspaceId: ws.id,
    name: "replica",
    host: "replica.allevents.in",
    username: "aesiteuser",
    password: "super-secret-pw",
    connectionMethod: "ssh",
    sshHost: "allevents.in",
    sshUsername: "ubuntu",
    sshAuthMethod: "privateKey",
    sshPrivateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nFAKEKEY\n-----END OPENSSH PRIVATE KEY-----",
  });
  console.log(`  database #${conn.id} has_password=${conn.has_password} has_ssh_secret=${conn.has_ssh_secret}`);

  // list() must never expose secrets.
  const leaks = JSON.stringify(databasesRepository.list(ws.id)).match(/super-secret-pw|FAKEKEY/);
  console.log("  list() leaks secrets?", leaks ? "YES (BUG)" : "no");

  // The runner bridge must decrypt secrets back to plaintext.
  const opts = databasesRepository.toRunnerOptions(conn.id);
  const pwOk = opts.connection.password === "super-secret-pw";
  const keyOk = opts.ssh?.auth.method === "privateKey" && opts.ssh.auth.privateKey.includes("FAKEKEY");
  console.log(`  toRunnerOptions decrypts password=${pwOk} ssh-key=${keyOk} tunneled=${Boolean(opts.ssh)}`);

  userLogsRepository.record({ workspaceId: ws.id, userId: user.id, action: "database.create", targetId: String(conn.id) });
  systemLogsRepository.record({ level: "info", source: "test", message: "smoke test ran" });
  console.log("  user_logs:", userLogsRepository.listForWorkspace(ws.id).length, "| system_logs:", systemLogsRepository.recent().length);

  const pass = tableCount >= 16 && pwOk && keyOk && !leaks;
  console.log(`\n${pass ? "✔ PASS" : "✗ FAIL"} — internal DB end-to-end`);

  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${TMP_DB}${suffix}`, { force: true });
  if (!pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error("\n✗ Test failed:", err);
  process.exitCode = 1;
});
