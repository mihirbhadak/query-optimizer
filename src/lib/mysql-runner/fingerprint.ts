import { createHash } from "node:crypto";

import type { OpenConnectionOptions } from "./types";

/**
 * Stable, secret-safe id for a pool. Identical destinations (same DB endpoint +
 * credentials + schema + ssh path) collapse onto one pool. Credentials are
 * hashed into the id, never stored raw.
 *
 * Note: `database` is part of the key, so two schemas on the same server get
 * separate pools (matching how mysql2 binds a default schema per connection).
 */
export function fingerprint(opts: OpenConnectionOptions): string {
  const { connection: c, ssh } = opts;

  const sshPart = ssh
    ? [
        "ssh",
        ssh.host,
        ssh.port ?? 22,
        ssh.username,
        ssh.auth.method === "password"
          ? `pw:${ssh.auth.password}`
          : `key:${ssh.auth.privateKey}:${ssh.auth.passphrase ?? ""}`,
      ].join("\0")
    : "direct";

  return createHash("sha256")
    .update(
      [
        c.host,
        c.port ?? 3306,
        c.user,
        c.password ?? "",
        c.database ?? "",
        JSON.stringify(c.ssl ?? null),
        sshPart,
      ].join(""),
    )
    .digest("hex")
    .slice(0, 24);
}
