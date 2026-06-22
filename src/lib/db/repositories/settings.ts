import { db } from "../client";

/** Raw key/value access for app settings. Values are JSON-encoded text. */
export const settingsRepository = {
  getRaw(key: string): string | undefined {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string | null }
      | undefined;
    return row?.value ?? undefined;
  },

  set(key: string, value: string): void {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    ).run(key, value);
  },

  all(): { key: string; value: string | null }[] {
    return db.prepare("SELECT key, value FROM settings ORDER BY key").all() as {
      key: string;
      value: string | null;
    }[];
  },
};
