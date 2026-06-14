/**
 * Public, in-process API for the SSH tunnel manager.
 *
 * Everything runs inside the query-optimizer process. A consumer (e.g. the future
 * mysql-runner) acquires a tunnel, gets a loopback host:port, builds its own
 * connection pool against it, and releases when done:
 *
 *   const t = await acquireTunnel({ ssh, target: { host: "127.0.0.1", port: 3306 } });
 *   const pool = mysql.createPool({ host: t.host, port: t.port, user, password, database });
 *   // ... use the pool ...
 *   await pool.end();
 *   await t.release();
 *
 * Identical (ssh + target) requests share one SSH connection (refcounted), so the
 * pool layer never pays for a redundant handshake.
 */

import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { TunnelManager } from "./manager";
import type { OpenTunnelOptions, TunnelHandle, TunnelInfo } from "./types";

// Persist a single manager across Next.js dev hot-reloads. Without this, HMR
// would build a fresh manager on every edit and leak the old tunnels/listeners.
const globalRef = globalThis as unknown as { __sshTunnelManager?: TunnelManager };

export const tunnelManager: TunnelManager =
  globalRef.__sshTunnelManager ?? (globalRef.__sshTunnelManager = new TunnelManager(loadConfig(), createLogger()));

/** Open (or join) a tunnel and get its full info. */
export function openTunnel(opts: OpenTunnelOptions): Promise<TunnelInfo> {
  return tunnelManager.open(opts);
}

/** Release one reference; the tunnel closes once the last holder releases it. */
export function closeTunnel(id: string, force = false): Promise<{ closed: boolean; refCount: number }> {
  return tunnelManager.close(id, force);
}

export function getTunnel(id: string): TunnelInfo | undefined {
  return tunnelManager.get(id);
}

export function listTunnels(): TunnelInfo[] {
  return tunnelManager.list();
}

/**
 * Ergonomic acquire/release wrapper. Returns just what a pool needs (host, port)
 * plus a one-shot `release()`. Intended entry point for the mysql-runner.
 */
export async function acquireTunnel(opts: OpenTunnelOptions): Promise<TunnelHandle> {
  const info = await openTunnel(opts);
  if (info.status !== "ready") {
    // Roll back our reference before surfacing the failure.
    await closeTunnel(info.id).catch(() => {});
    throw new Error(`Tunnel ${info.id} is not ready (status: ${info.status}). ${info.lastError ?? ""}`.trim());
  }

  let released = false;
  return {
    id: info.id,
    host: info.localHost,
    port: info.localPort,
    release: async () => {
      if (released) return;
      released = true;
      await closeTunnel(info.id);
    },
  };
}

export type {
  OpenTunnelOptions,
  TunnelHandle,
  TunnelInfo,
  TunnelStatus,
  SshConfig,
  SshAuth,
  TunnelTarget,
} from "./types";
