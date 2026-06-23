/**
 * SettingsService — typed access to app-level settings, stored as JSON in the
 * `settings` table. Add typed accessors here as new settings are introduced.
 */

import { settingsRepository } from "@/lib/db";

export const SETTING_KEYS = {
  signupRequiresApproval: "signup_requires_approval",
  userLogRetentionDays: "user_log_retention_days",
  systemLogRetentionDays: "system_log_retention_days",
  logAutoClearEnabled: "log_auto_clear_enabled",
  logLastPrunedAt: "log_last_pruned_at",
} as const;

export class SettingsService {
  getBool(key: string, fallback = false): boolean {
    const raw = settingsRepository.getRaw(key);
    if (raw == null) return fallback;
    try {
      return Boolean(JSON.parse(raw));
    } catch {
      return fallback;
    }
  }

  setBool(key: string, value: boolean): void {
    settingsRepository.set(key, JSON.stringify(value));
  }

  getNumber(key: string, fallback = 0): number {
    const raw = settingsRepository.getRaw(key);
    if (raw == null) return fallback;
    try {
      const n = Number(JSON.parse(raw));
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  setNumber(key: string, value: number): void {
    settingsRepository.set(key, JSON.stringify(value));
  }

  getString(key: string): string | undefined {
    const raw = settingsRepository.getRaw(key);
    if (raw == null) return undefined;
    try {
      return String(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }

  setString(key: string, value: string): void {
    settingsRepository.set(key, JSON.stringify(value));
  }

  /** Whether new signups must be approved by an admin before they can log in. */
  signupRequiresApproval(): boolean {
    return this.getBool(SETTING_KEYS.signupRequiresApproval, false);
  }

  setSignupRequiresApproval(value: boolean): void {
    this.setBool(SETTING_KEYS.signupRequiresApproval, value);
  }
}

export const settingsService = new SettingsService();
