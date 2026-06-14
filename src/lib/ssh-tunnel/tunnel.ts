import net from "node:net";
import { createHash } from "node:crypto";
import { Client as SshClient, type ConnectConfig } from "ssh2";

import type { TunnelConfig } from "./config";
import type { Logger } from "./logger";
import type { OpenTunnelOptions, TunnelInfo, TunnelStatus } from "./types";

const DEFAULT_SSH_PORT = 22;

/**
 * One persistent SSH connection plus a local TCP listener bound to loopback.
 * Every socket accepted on the listener is forwarded, through the SSH channel,
 * to `target`. The listener stays bound across SSH reconnects, so the consumer
 * keeps a stable host:port for the life of the tunnel.
 */
export class Tunnel {
  readonly id: string;
  readonly opts: OpenTunnelOptions;
  private readonly config: TunnelConfig;
  private readonly log: Logger;

  private ssh?: SshClient;
  private server?: net.Server;
  private localPort = 0;

  status: TunnelStatus = "connecting";
  refCount = 1;
  lastError?: string;

  private readonly createdAt = new Date();
  private lastActivityAt = new Date();
  private activeConnections = 0;
  private totalConnections = 0;
  private reconnects = 0;

  private closing = false;
  private reconnectAttempt = 0;
  private reconnectTimer?: NodeJS.Timeout;
  /** Resolves once the listener is bound and SSH is ready (or rejects on failure). */
  private readonly ready: Promise<void>;

  constructor(id: string, opts: OpenTunnelOptions, config: TunnelConfig, log: Logger) {
    this.id = id;
    this.opts = opts;
    this.config = config;
    this.log = log.child({ tunnel: id });
    this.ready = this.start();
  }

  get idleTimeoutMs(): number {
    return this.opts.idleTimeoutMs ?? this.config.defaultIdleTimeoutMs;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private async start(): Promise<void> {
    await this.listen();
    await this.connectSsh();
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on("connection", (socket) => this.handleConnection(socket));
      server.on("error", (err) => {
        this.log.error({ err: err.message }, "local listener error");
        reject(err);
      });
      // Port 0 => OS assigns a free ephemeral port.
      server.listen(0, this.config.bindHost, () => {
        const addr = server.address();
        if (addr === null || typeof addr === "string") {
          reject(new Error("Failed to resolve assigned local port."));
          return;
        }
        this.server = server;
        this.localPort = addr.port;
        this.log.info({ localPort: this.localPort }, "listener bound");
        resolve();
      });
    });
  }

  private connectSsh(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new SshClient();
      let settled = false;

      client.on("ready", () => {
        this.ssh = client;
        this.status = "ready";
        this.reconnectAttempt = 0;
        this.lastError = undefined;
        this.log.info("ssh ready");
        settled = true;
        resolve();
      });

      client.on("error", (err) => {
        this.lastError = err.message;
        this.log.warn({ err: err.message }, "ssh error");
        if (!settled) {
          settled = true;
          reject(new Error(`SSH connection failed: ${err.message}`));
        }
      });

      client.on("close", () => {
        if (this.closing) return;
        // Unexpected drop of an established connection -> try to reconnect.
        if (this.status === "ready") {
          this.status = "reconnecting";
          this.ssh = undefined;
          this.scheduleReconnect();
        }
      });

      client.connect(this.buildConnectConfig());
    });
  }

  private scheduleReconnect(): void {
    if (this.closing) return;
    if (this.reconnectAttempt >= this.config.reconnectMaxRetries) {
      this.status = "error";
      this.lastError = `Gave up reconnecting after ${this.reconnectAttempt} attempts.`;
      this.log.error("reconnect exhausted; tunnel is dead");
      return;
    }
    const delay = Math.min(
      this.config.reconnectBaseDelayMs * 2 ** this.reconnectAttempt,
      this.config.reconnectMaxDelayMs,
    );
    this.reconnectAttempt += 1;
    this.log.warn({ attempt: this.reconnectAttempt, delay }, "scheduling reconnect");
    this.reconnectTimer = setTimeout(() => {
      this.connectSsh()
        .then(() => {
          this.reconnects += 1;
          this.log.info("reconnected");
        })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }

  private handleConnection(socket: net.Socket): void {
    const client = this.ssh;
    if (this.status !== "ready" || client === undefined) {
      // SSH is mid-(re)connect or dead — refuse rather than hang the caller.
      socket.destroy();
      return;
    }

    this.totalConnections += 1;
    this.activeConnections += 1;
    this.touch();
    const srcPort = socket.remotePort ?? 0;

    client.forwardOut(
      "127.0.0.1",
      srcPort,
      this.opts.target.host,
      this.opts.target.port,
      (err, stream) => {
        if (err) {
          this.log.warn({ err: err.message }, "forwardOut failed");
          this.releaseConnection();
          socket.destroy();
          return;
        }

        let released = false;
        const done = () => {
          if (released) return;
          released = true;
          this.releaseConnection();
        };

        socket.pipe(stream).pipe(socket);
        stream.on("close", done);
        socket.on("close", () => {
          stream.destroy();
          done();
        });
        socket.on("error", () => stream.destroy());
        stream.on("error", () => socket.destroy());
      },
    );
  }

  private releaseConnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.touch();
  }

  private touch(): void {
    this.lastActivityAt = new Date();
  }

  /** True if eligible for idle reaping right now. */
  isIdleExpired(now: number): boolean {
    if (this.idleTimeoutMs <= 0) return false;
    if (this.activeConnections > 0) return false;
    return now - this.lastActivityAt.getTime() >= this.idleTimeoutMs;
  }

  private buildConnectConfig(): ConnectConfig {
    const { ssh } = this.opts;
    const cfg: ConnectConfig = {
      host: ssh.host,
      port: ssh.port ?? DEFAULT_SSH_PORT,
      username: ssh.username,
      readyTimeout: this.config.sshConnectTimeoutMs,
      keepaliveInterval: this.config.sshKeepaliveMs,
      keepaliveCountMax: 3,
    };

    if (ssh.auth.method === "password") {
      cfg.password = ssh.auth.password;
    } else {
      cfg.privateKey = ssh.auth.privateKey;
      if (ssh.auth.passphrase) cfg.passphrase = ssh.auth.passphrase;
    }

    if (ssh.expectedHostKeySha256) {
      const expected = ssh.expectedHostKeySha256.replace(/:/g, "").toLowerCase();
      cfg.hostVerifier = (key: Buffer) =>
        createHash("sha256").update(key).digest("hex") === expected;
    }

    return cfg;
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.status = "closed";
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ssh?.end();
    this.ssh = undefined;
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
    this.log.info("tunnel closed");
  }

  toInfo(): TunnelInfo {
    const { ssh, target } = this.opts;
    return {
      id: this.id,
      status: this.status,
      localHost: this.config.advertiseHost,
      localPort: this.localPort,
      ssh: { host: ssh.host, port: ssh.port ?? DEFAULT_SSH_PORT, username: ssh.username },
      target: { host: target.host, port: target.port },
      label: this.opts.label,
      refCount: this.refCount,
      idleTimeoutMs: this.idleTimeoutMs,
      createdAt: this.createdAt.toISOString(),
      lastActivityAt: this.lastActivityAt.toISOString(),
      activeConnections: this.activeConnections,
      totalConnections: this.totalConnections,
      reconnects: this.reconnects,
      lastError: this.lastError,
    };
  }
}
