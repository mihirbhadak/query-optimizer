/**
 * Log retention / cleanup. Admins configure how long user/system logs are kept
 * and whether they're auto-cleared; they can also clear logs manually. "Auto"
 * runs opportunistically (throttled) on admin requests via maybePrune() — no
 * external scheduler needed for the single long-lived container.
 */

import { nowTs, systemLogsRepository, userLogsRepository } from "@/lib/db";
import { SETTING_KEYS, settingsService } from "@/lib/settings";

import { systemLogService } from "./system-log-service";

/** Auto-prune runs at most this often. */
const PRUNE_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type LogType = "user" | "system" | "all";

export interface RetentionConfig {
  /** Days to keep user logs; 0 = keep forever. */
  userDays: number;
  /** Days to keep system logs; 0 = keep forever. */
  systemDays: number;
  /** Whether expired logs are cleared automatically. */
  autoEnabled: boolean;
}

export interface RetentionStats {
  userTotal: number;
  systemTotal: number;
  lastPrunedAt: string | null;
}

export interface PruneResult {
  userDeleted: number;
  systemDeleted: number;
}

class LogRetentionService {
  /** In-process throttle so concurrent requests don't all hit the DB. */
  private lastCheck = 0;

  getConfig(): RetentionConfig {
    return {
      userDays: settingsService.getNumber(SETTING_KEYS.userLogRetentionDays, 90),
      systemDays: settingsService.getNumber(SETTING_KEYS.systemLogRetentionDays, 90),
      autoEnabled: settingsService.getBool(SETTING_KEYS.logAutoClearEnabled, false),
    };
  }

  setConfig(c: RetentionConfig): void {
    settingsService.setNumber(SETTING_KEYS.userLogRetentionDays, Math.max(0, Math.floor(c.userDays || 0)));
    settingsService.setNumber(SETTING_KEYS.systemLogRetentionDays, Math.max(0, Math.floor(c.systemDays || 0)));
    settingsService.setBool(SETTING_KEYS.logAutoClearEnabled, c.autoEnabled);
  }

  stats(): RetentionStats {
    return {
      userTotal: userLogsRepository.total(),
      systemTotal: systemLogsRepository.total(),
      lastPrunedAt: settingsService.getString(SETTING_KEYS.logLastPrunedAt) ?? null,
    };
  }

  /** Apply the retention policy now (deletes entries older than the kept days). */
  prune(): PruneResult {
    const c = this.getConfig();
    const userDeleted = userLogsRepository.deleteOlderThan(c.userDays);
    const systemDeleted = systemLogsRepository.deleteOlderThan(c.systemDays);
    settingsService.setString(SETTING_KEYS.logLastPrunedAt, nowTs());
    if (userDeleted + systemDeleted > 0) {
      systemLogService.info("Logs pruned by retention policy", {
        source: "retention",
        metadata: { userDeleted, systemDeleted, userDays: c.userDays, systemDays: c.systemDays },
      });
    }
    return { userDeleted, systemDeleted };
  }

  /** Throttled auto-prune; safe to call on every admin request. */
  maybePrune(): void {
    const c = this.getConfig();
    if (!c.autoEnabled) return;
    const now = Date.now();
    if (now - this.lastCheck < PRUNE_INTERVAL_MS) return;
    this.lastCheck = now;
    // Persistent throttle so a restart doesn't re-prune immediately.
    const last = settingsService.getString(SETTING_KEYS.logLastPrunedAt);
    if (last) {
      const lastMs = Date.parse(`${last.replace(" ", "T")}Z`);
      if (Number.isFinite(lastMs) && now - lastMs < PRUNE_INTERVAL_MS) return;
    }
    try {
      this.prune();
    } catch {
      // Never let log cleanup break a request.
    }
  }

  /** Manual clear. `all` clears both tables. Returns counts deleted. */
  clear(type: LogType): PruneResult {
    return {
      userDeleted: type === "user" || type === "all" ? userLogsRepository.deleteAll() : 0,
      systemDeleted: type === "system" || type === "all" ? systemLogsRepository.deleteAll() : 0,
    };
  }
}

export const logRetentionService = new LogRetentionService();
