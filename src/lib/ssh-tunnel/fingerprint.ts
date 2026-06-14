import { createHash } from "node:crypto";

import type { OpenTunnelOptions } from "./types";

/**
 * Stable, secret-safe id for a tunnel request. Identical requests (same SSH
 * endpoint + credentials + target) collapse onto one tunnel, which is then
 * refcounted. The credential is hashed into the id, never stored raw.
 */
export function fingerprint(opts: OpenTunnelOptions): string {
  const { ssh, target } = opts;
  const credential =
    ssh.auth.method === "password"
      ? `pw:${ssh.auth.password}`
      : `key:${ssh.auth.privateKey}:${ssh.auth.passphrase ?? ""}`;

  return createHash("sha256")
    .update(
      [ssh.host, ssh.port ?? 22, ssh.username, credential, target.host, target.port].join("\0"),
    )
    .digest("hex")
    .slice(0, 24);
}
