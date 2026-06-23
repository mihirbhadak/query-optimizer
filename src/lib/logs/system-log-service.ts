/**
 * SystemLogService — the single place that writes/reads the `system_logs` table
 * (system events and errors, distinct from the per-user audit trail). Business
 * code calls the level helpers; nothing else touches the repository directly.
 */

import {
  systemLogsRepository,
  type SystemLogQuery,
} from "@/lib/db";
import type { LogLevel, SystemLog } from "@/types/db";

export interface SystemLogInput {
  source?: string;
  metadata?: Record<string, unknown>;
}

export class SystemLogService {
  log(level: LogLevel, message: string, input: SystemLogInput = {}): SystemLog {
    return systemLogsRepository.record({
      level,
      source: input.source,
      message,
      metadata: input.metadata,
    });
  }

  debug(message: string, input?: SystemLogInput) {
    return this.log("debug", message, input);
  }
  info(message: string, input?: SystemLogInput) {
    return this.log("info", message, input);
  }
  warn(message: string, input?: SystemLogInput) {
    return this.log("warn", message, input);
  }
  error(message: string, input?: SystemLogInput) {
    return this.log("error", message, input);
  }

  recent(limit = 100): SystemLog[] {
    return systemLogsRepository.recent(limit);
  }

  query(q: SystemLogQuery): SystemLog[] {
    return systemLogsRepository.query(q);
  }

  count(q: SystemLogQuery): number {
    return systemLogsRepository.count(q);
  }

  sources(): string[] {
    return systemLogsRepository.distinctSources();
  }
}

export const systemLogService = new SystemLogService();
