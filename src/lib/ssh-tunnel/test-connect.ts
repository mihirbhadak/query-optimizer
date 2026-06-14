/**
 * Manual smoke test for the SSH tunnel manager.
 *
 *   npm run test:tunnel                       # uses services/ssh-tunnel/test_config.txt
 *   npm run test:tunnel -- path/to/config.txt # custom config
 *
 * Config file format:
 *   host: <ssh host>
 *   user: <ssh user>
 *   key:
 *   -----BEGIN OPENSSH PRIVATE KEY-----
 *   ...
 *   -----END OPENSSH PRIVATE KEY-----
 *
 * Target DB to forward to is taken from env (defaults to 127.0.0.1:3306):
 *   SSH_TUNNEL_TEST_TARGET_HOST, SSH_TUNNEL_TEST_TARGET_PORT
 */

import net from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { acquireTunnel, tunnelManager } from "./index";
import type { SshConfig } from "./types";

interface ParsedConfig {
  host: string;
  user: string;
  privateKey: string;
  passphrase?: string;
}

function parseConfig(raw: string): ParsedConfig {
  const host = /^\s*host:\s*(.+?)\s*$/im.exec(raw)?.[1];
  const user = /^\s*user:\s*(.+?)\s*$/im.exec(raw)?.[1];
  const keyMatch = /(-----BEGIN [^-]+ KEY-----[\s\S]+?-----END [^-]+ KEY-----)/.exec(raw);
  const passphrase = /^\s*passphrase:\s*(.+?)\s*$/im.exec(raw)?.[1];

  if (!host) throw new Error('Config missing "host:".');
  if (!user) throw new Error('Config missing "user:".');
  if (!keyMatch) throw new Error("Config missing a PEM private key block.");

  return {
    host,
    user,
    // ssh2 wants a trailing newline on the PEM.
    privateKey: `${keyMatch[1].trim()}\n`,
    passphrase,
  };
}

/** Open a raw socket to the tunnel and see if the target speaks (e.g. MySQL banner). */
function probeForward(host: string, port: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let gotData = false;
    const timer = setTimeout(() => {
      socket.destroy();
      resolve("connected, but the target sent no banner within 4s (target may not be MySQL).");
    }, 4000);
    const finish = (msg: string) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(msg);
    };

    socket.once("data", (buf) => {
      gotData = true;
      // MySQL handshake: [3-byte len][1-byte seq][1-byte protocol][null-terminated version].
      let banner = "received data from target (forwarding works).";
      if (buf.length > 5) {
        const end = buf.indexOf(0x00, 5);
        if (end > 5) banner = `MySQL handshake OK — server version: ${buf.toString("utf8", 5, end)}`;
      }
      finish(banner);
    });

    socket.once("error", (err) => finish(`forwarding failed: ${err.message}`));
    // forwardOut failures (e.g. the DB port refusing) destroy the tunneled stream,
    // which closes our local socket before any data arrives.
    socket.once("close", () => {
      if (!gotData) {
        finish(
          "forwarding refused — the SSH host could not reach the target host:port " +
            "(wrong DB host/port, or DB not listening there). The SSH tunnel itself is fine.",
        );
      }
    });
  });
}

async function main(): Promise<void> {
  const configPath = resolve(
    process.argv[2] ?? "services/ssh-tunnel/test_config.txt",
  );
  console.log(`Reading config: ${configPath}`);
  const cfg = parseConfig(readFileSync(configPath, "utf8"));

  const targetHost = process.env.SSH_TUNNEL_TEST_TARGET_HOST ?? "127.0.0.1";
  const targetPort = Number(process.env.SSH_TUNNEL_TEST_TARGET_PORT ?? "3306");

  const ssh: SshConfig = {
    host: cfg.host,
    username: cfg.user,
    auth: { method: "privateKey", privateKey: cfg.privateKey, passphrase: cfg.passphrase },
  };

  console.log(`\nOpening tunnel: ${cfg.user}@${cfg.host} -> ${targetHost}:${targetPort} ...`);
  const start = Date.now();
  const handle = await acquireTunnel({
    ssh,
    target: { host: targetHost, port: targetPort },
    label: "test-connect",
  });
  console.log(`✔ SSH tunnel established in ${Date.now() - start}ms`);
  console.log(`  local endpoint: ${handle.host}:${handle.port}  (tunnel id: ${handle.id})`);

  console.log(`\nProbing forward to ${targetHost}:${targetPort} ...`);
  console.log(`  ${await probeForward(handle.host, handle.port)}`);

  // Prove reuse/refcount: a second acquire of the same endpoint should not reconnect.
  const again = await acquireTunnel({ ssh, target: { host: targetHost, port: targetPort } });
  const info = tunnelManager.get(again.id);
  console.log(`\nRefcount after second acquire: ${info?.refCount} (expected 2, same tunnel reused)`);
  await again.release();

  await handle.release();
  console.log(`\nReleased. Active tunnels now: ${tunnelManager.list().length}`);
  await tunnelManager.shutdown();
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nx Test failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
  void tunnelManager.shutdown();
});
