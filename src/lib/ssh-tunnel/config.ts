/**
 * Manager tuning. Sensible defaults for in-process use; every value can be
 * overridden by an env var, but nothing is required.
 */

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

export interface TunnelConfig {
  /** Interface the per-tunnel listeners bind to. Loopback by default — the
   *  consumer is in the same process/container, so nothing is network-exposed. */
  bindHost: string;
  /** Host reported in TunnelInfo.localHost (what the consumer connects to). */
  advertiseHost: string;
  /** Default idle timeout (ms). 0 = persistent until released/closed. */
  defaultIdleTimeoutMs: number;
  maxTunnels: number;
  sshKeepaliveMs: number;
  sshConnectTimeoutMs: number;
  reconnectMaxRetries: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
}

export function loadConfig(): TunnelConfig {
  return {
    bindHost: str("SSH_TUNNEL_BIND_HOST", "127.0.0.1"),
    advertiseHost: str("SSH_TUNNEL_ADVERTISE_HOST", "127.0.0.1"),
    defaultIdleTimeoutMs: int("SSH_TUNNEL_IDLE_TIMEOUT_MS", 0),
    maxTunnels: int("SSH_TUNNEL_MAX", 200),
    sshKeepaliveMs: int("SSH_TUNNEL_KEEPALIVE_MS", 15000),
    sshConnectTimeoutMs: int("SSH_TUNNEL_CONNECT_TIMEOUT_MS", 15000),
    reconnectMaxRetries: int("SSH_TUNNEL_RECONNECT_MAX_RETRIES", 10),
    reconnectBaseDelayMs: int("SSH_TUNNEL_RECONNECT_BASE_DELAY_MS", 1000),
    reconnectMaxDelayMs: int("SSH_TUNNEL_RECONNECT_MAX_DELAY_MS", 30000),
  };
}
