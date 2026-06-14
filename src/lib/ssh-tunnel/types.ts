/**
 * In-process SSH tunnel manager types.
 *
 * The tunnel library is self-contained and knows nothing about MySQL — a future
 * mysql-runner imports it, opens a tunnel, and points a connection pool at the
 * returned loopback host:port. Keeping these types here (rather than reusing the
 * mysql ones) keeps the dependency arrow one-way: mysql-runner -> ssh-tunnel.
 */

/** How to authenticate the SSH connection. */
export type SshAuth =
  | { method: "password"; password: string }
  | {
      method: "privateKey";
      /** PEM-encoded private key contents (OpenSSH or PKCS#8). */
      privateKey: string;
      /** Passphrase, only if the key is encrypted. */
      passphrase?: string;
    };

/** SSH endpoint to tunnel through. */
export interface SshConfig {
  host: string;
  /** Defaults to 22. */
  port?: number;
  username: string;
  auth: SshAuth;
  /** Pin the host fingerprint (sha256 hex, colons optional). Optional. */
  expectedHostKeySha256?: string;
}

/** The host:port to reach *from the SSH server* (e.g. the database). */
export interface TunnelTarget {
  host: string;
  port: number;
}

export interface OpenTunnelOptions {
  ssh: SshConfig;
  target: TunnelTarget;
  /**
   * Auto-close after this many ms with no active connections. 0 = persistent
   * (stays open until released/closed). Omit to use the manager default.
   */
  idleTimeoutMs?: number;
  /** Free-form label surfaced in listings/logs (must not contain secrets). */
  label?: string;
}

export type TunnelStatus = "connecting" | "ready" | "reconnecting" | "closed" | "error";

/** Public, secret-free view of a tunnel. */
export interface TunnelInfo {
  id: string;
  status: TunnelStatus;
  /** Loopback host the forwarded port is bound to (for in-process consumers). */
  localHost: string;
  localPort: number;
  ssh: { host: string; port: number; username: string };
  target: TunnelTarget;
  label?: string;
  refCount: number;
  idleTimeoutMs: number;
  createdAt: string;
  lastActivityAt: string;
  activeConnections: number;
  totalConnections: number;
  reconnects: number;
  lastError?: string;
}

/**
 * Handle returned by `acquireTunnel`. Hold it for as long as you use the tunnel
 * (e.g. the lifetime of a mysql pool), then call `release()` exactly once.
 */
export interface TunnelHandle {
  id: string;
  host: string;
  port: number;
  /** Drop this caller's reference; the tunnel closes once the last holder releases. */
  release: () => Promise<void>;
}
