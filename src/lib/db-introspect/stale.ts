/**
 * Server-side relative-time + staleness for a database's last sync. Kept out of
 * React components so the time read (Date.now) stays pure from the UI's point of
 * view — the computed label/flag are passed to the client as plain data.
 */

import { STALE_AFTER_MS } from "./types";

export interface LastSyncInfo {
  /** Human label, e.g. "5m ago" or "never". */
  label: string;
  /** True when the data is older than the staleness window (or never synced). */
  isStale: boolean;
}

function relative(diffMs: number): string {
  const s = Math.round(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function lastSyncInfo(lastSyncAt: string | null): LastSyncInfo {
  if (!lastSyncAt) return { label: "never", isStale: true };
  // Stored as SQLite UTC "YYYY-MM-DD HH:MM:SS".
  const ms = Date.parse(lastSyncAt.includes("T") ? lastSyncAt : `${lastSyncAt.replace(" ", "T")}Z`);
  if (!Number.isFinite(ms)) return { label: "unknown", isStale: false };
  const diff = Date.now() - ms;
  return { label: relative(diff), isStale: diff > STALE_AFTER_MS };
}
