/**
 * Tiny console logger — no external dependency, mirrors the ssh-tunnel logger.
 * Callers must never pass credentials in the fields object; the manager only
 * logs endpoints, ids, counts.
 */

type Fields = Record<string, unknown>;
type Level = "info" | "warn" | "error";

export interface Logger {
  child(fields: Fields): Logger;
  info(fields: Fields | string, msg?: string): void;
  warn(fields: Fields | string, msg?: string): void;
  error(fields: Fields | string, msg?: string): void;
}

export function createLogger(base: Fields = {}): Logger {
  const emit = (level: Level, a: Fields | string, b?: string) => {
    const fields = typeof a === "string" ? {} : a;
    const msg = typeof a === "string" ? a : (b ?? "");
    const merged = { ...base, ...fields };
    const line = `[mysql-runner] ${msg}`;
    // eslint-disable-next-line no-console
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    sink(line, Object.keys(merged).length ? merged : "");
  };

  return {
    child: (fields: Fields) => createLogger({ ...base, ...fields }),
    info: (a, b) => emit("info", a, b),
    warn: (a, b) => emit("warn", a, b),
    error: (a, b) => emit("error", a, b),
  };
}
