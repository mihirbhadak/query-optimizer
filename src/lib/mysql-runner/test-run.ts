/**
 * Manual smoke test for the pooled MySQL runner.
 *
 *   npm run test:db                       # uses mihir/test/config/database.txt
 *   npm run test:db -- path/to/config.txt
 *
 * Config file format (the `---- ssh ----` block is optional — omit it to connect
 * directly):
 *
 *   host: db.example.com
 *   user: appuser
 *   pass: secret
 *   port: 3306            # optional, defaults 3306
 *   database: shop        # optional
 *
 *   ---- ssh -----
 *   host: bastion.example.com
 *   user: ubuntu
 *   key:
 *   -----BEGIN OPENSSH PRIVATE KEY-----
 *   ...
 *   -----END OPENSSH PRIVATE KEY-----
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closeConnection, databaseManager, listConnections, runQuery } from "./index";
import type { OpenConnectionOptions } from "./types";

function field(block: string, name: string): string | undefined {
  return new RegExp(`^\\s*${name}\\s*:\\s*(.+?)\\s*$`, "im").exec(block)?.[1]?.trim();
}

function parseConfig(input: string): OpenConnectionOptions {
  // Normalize CRLF so regexes and key blocks parse cleanly on any platform.
  const raw = input.replace(/\r\n/g, "\n");
  // Split DB section from optional SSH section on a `---- ssh ----` divider.
  const [dbBlock, sshBlock] = raw.split(/^-+\s*ssh\s*-+\s*$/im);

  const host = field(dbBlock, "host");
  const user = field(dbBlock, "user");
  const password = field(dbBlock, "pass") ?? field(dbBlock, "password");
  const port = field(dbBlock, "port");
  const database = field(dbBlock, "database") ?? field(dbBlock, "db");
  if (!host) throw new Error('DB config missing "host:".');
  if (!user) throw new Error('DB config missing "user:".');

  const opts: OpenConnectionOptions = {
    connection: {
      host,
      user,
      password,
      port: port ? Number(port) : undefined,
      database,
    },
    label: "test-db",
  };

  if (sshBlock && sshBlock.trim()) {
    const sshHost = field(sshBlock, "host");
    const sshUser = field(sshBlock, "user");
    const keyMatch = /(-----BEGIN [^-]+ KEY-----[\s\S]+?-----END [^-]+ KEY-----)/.exec(sshBlock);
    const sshPass = field(sshBlock, "pass") ?? field(sshBlock, "password");
    if (!sshHost || !sshUser) throw new Error("SSH block missing host/user.");

    if (keyMatch) {
      opts.ssh = {
        host: sshHost,
        username: sshUser,
        auth: { method: "privateKey", privateKey: `${keyMatch[1].trim()}\n` },
      };
    } else if (sshPass) {
      opts.ssh = { host: sshHost, username: sshUser, auth: { method: "password", password: sshPass } };
    } else {
      throw new Error("SSH block has neither a private key nor a password.");
    }
  }

  return opts;
}

async function main(): Promise<void> {
  const configPath = resolve(process.argv[2] ?? "mihir/test/config/database.txt");
  console.log(`Reading config: ${configPath}`);
  const opts = parseConfig(readFileSync(configPath, "utf8"));

  console.log(
    `\nTarget: ${opts.connection.user}@${opts.connection.host}:${opts.connection.port ?? 3306}` +
      (opts.ssh ? `  via ssh ${opts.ssh.username}@${opts.ssh.host}` : "  (direct)"),
  );

  // 1. Open the pool + run a first query (pays SSH + DB handshake once).
  const t0 = Date.now();
  const r1 = await runQuery({ ...opts, query: "SELECT VERSION() AS version, NOW() AS now", readOnly: true });
  console.log(`\n✔ Connected & queried in ${Date.now() - t0}ms${r1.tunneled ? " (via SSH tunnel)" : ""}`);
  console.log("  ", JSON.stringify((r1.rows as unknown[])[0]));
  console.log(`  connection id: ${r1.connectionId}`);

  // 2. Second query reuses the pool — should be much faster (no handshake).
  const t1 = Date.now();
  const r2 = await runQuery({ ...opts, query: "SELECT DATABASE() AS db, CURRENT_USER() AS user", readOnly: true });
  console.log(`\n✔ Second query reused the pool in ${Date.now() - t1}ms`);
  console.log("  ", JSON.stringify((r2.rows as unknown[])[0]));

  // 3. A few concurrent queries to exercise the pool.
  const t2 = Date.now();
  const concurrent = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      runQuery({ ...opts, query: "SELECT ? AS n, CONNECTION_ID() AS conn", params: [n], readOnly: true }),
    ),
  );
  console.log(`\n✔ 5 concurrent queries in ${Date.now() - t2}ms — server connection ids:`);
  console.log(
    "  ",
    concurrent.map((r) => (r.rows as { conn: number }[])[0]?.conn).join(", "),
  );

  // 4. Read-only guard should reject a write.
  try {
    await runQuery({ ...opts, query: "DELETE FROM nonexistent_table WHERE 1=0", readOnly: true });
    console.log("\n✗ Read-only guard did NOT block a DELETE (unexpected).");
  } catch (err) {
    console.log(`\n✔ Read-only guard blocked a write: ${err instanceof Error ? err.message : err}`);
  }

  // 5. Pool listing / stats.
  console.log("\nActive connections:");
  for (const c of listConnections()) {
    console.log(
      `  ${c.id}  ${c.status}  ${c.db.user}@${c.db.host}:${c.db.port}` +
        `  queries=${c.totalQueries}  errors=${c.errors}  tunneled=${c.tunneled}`,
    );
  }

  // 6. Close.
  await closeConnection(r1.connectionId);
  console.log(`\nClosed. Active connections now: ${listConnections().length}`);
  await databaseManager.shutdown();
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nx Test failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
  void databaseManager.shutdown();
});
