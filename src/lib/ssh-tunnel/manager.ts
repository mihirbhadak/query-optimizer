import type { TunnelConfig } from "./config";
import type { Logger } from "./logger";
import type { OpenTunnelOptions, TunnelInfo } from "./types";
import { fingerprint } from "./fingerprint";
import { Tunnel } from "./tunnel";

const IDLE_SWEEP_INTERVAL_MS = 5000;

function validate(opts: OpenTunnelOptions): void {
  if (!opts || typeof opts !== "object") throw new Error("Tunnel options are required.");
  const { ssh, target } = opts;
  if (!ssh?.host) throw new Error("ssh.host is required.");
  if (!ssh?.username) throw new Error("ssh.username is required.");
  if (!ssh?.auth) throw new Error("ssh.auth is required.");
  if (ssh.auth.method === "password" && !ssh.auth.password) {
    throw new Error("ssh.auth.password is required for password auth.");
  }
  if (ssh.auth.method === "privateKey" && !ssh.auth.privateKey) {
    throw new Error("ssh.auth.privateKey is required for key auth.");
  }
  if (!target?.host) throw new Error("target.host is required.");
  if (!target?.port) throw new Error("target.port is required.");
}

/**
 * Owns the set of live tunnels for the process. Deduplicates identical requests
 * by fingerprint and refcounts them, sweeps idle tunnels, and tears everything
 * down on shutdown. A single instance is shared process-wide (see index.ts).
 */
export class TunnelManager {
  private readonly tunnels = new Map<string, Tunnel>();
  /** Guards against two concurrent opens racing to create the same fingerprint. */
  private readonly pending = new Map<string, Promise<Tunnel>>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    private readonly config: TunnelConfig,
    private readonly log: Logger,
  ) {
    this.sweepTimer = setInterval(() => this.sweepIdle(), IDLE_SWEEP_INTERVAL_MS);
    // Don't keep the event loop alive just for the sweep.
    this.sweepTimer.unref();
  }

  async open(opts: OpenTunnelOptions): Promise<TunnelInfo> {
    validate(opts);
    const id = fingerprint(opts);

    const existing = this.tunnels.get(id);
    if (existing && existing.status !== "closed" && existing.status !== "error") {
      existing.refCount += 1;
      this.log.info({ tunnel: id, refCount: existing.refCount }, "reusing tunnel");
      return existing.toInfo();
    }

    const inFlight = this.pending.get(id);
    if (inFlight) {
      const tunnel = await inFlight;
      tunnel.refCount += 1;
      return tunnel.toInfo();
    }

    if (this.tunnels.size >= this.config.maxTunnels) {
      throw new Error(`Tunnel limit reached (${this.config.maxTunnels}).`);
    }

    const create = (async () => {
      const tunnel = new Tunnel(id, opts, this.config, this.log);
      try {
        await tunnel.whenReady();
      } catch (err) {
        await tunnel.close().catch(() => {});
        throw err instanceof Error ? err : new Error("SSH connect failed.");
      }
      this.tunnels.set(id, tunnel);
      return tunnel;
    })();

    this.pending.set(id, create);
    try {
      const tunnel = await create;
      return tunnel.toInfo();
    } finally {
      this.pending.delete(id);
    }
  }

  get(id: string): TunnelInfo | undefined {
    return this.tunnels.get(id)?.toInfo();
  }

  list(): TunnelInfo[] {
    return [...this.tunnels.values()].map((t) => t.toInfo());
  }

  /**
   * Decrement the refcount; close once it hits zero. `force` closes immediately
   * regardless of other holders.
   */
  async close(id: string, force = false): Promise<{ closed: boolean; refCount: number }> {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) return { closed: false, refCount: 0 };

    if (!force) {
      tunnel.refCount -= 1;
      if (tunnel.refCount > 0) {
        this.log.info({ tunnel: id, refCount: tunnel.refCount }, "released tunnel ref");
        return { closed: false, refCount: tunnel.refCount };
      }
    }

    this.tunnels.delete(id);
    await tunnel.close();
    return { closed: true, refCount: 0 };
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const [id, tunnel] of this.tunnels) {
      if (tunnel.refCount <= 0 || tunnel.isIdleExpired(now)) {
        this.log.info({ tunnel: id }, "reaping idle tunnel");
        this.tunnels.delete(id);
        void tunnel.close().catch(() => {});
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.sweepTimer);
    const all = [...this.tunnels.values()];
    this.tunnels.clear();
    await Promise.allSettled(all.map((t) => t.close()));
  }
}
