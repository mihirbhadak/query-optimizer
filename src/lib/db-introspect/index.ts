/**
 * Schema-introspection service.
 *
 *   import { syncManager } from "@/lib/db-introspect";
 *   syncManager.requestSync(databaseId, { requestedBy, trigger });
 *
 * Connects to a saved database (direct or via SSH), reads its structure with
 * cheap dictionary queries, and stores tables/columns/indexes in the internal DB.
 * Runs in the background, in parallel across databases, one job per database.
 */

export { syncManager, type RequestResult, type SyncJobDetailedView } from "./sync-manager";
export { lastSyncInfo, type LastSyncInfo } from "./stale";
export {
  PHASE_PROGRESS,
  PHASE_LABEL,
  STALE_AFTER_MS,
  type SyncPhase,
  type SyncJobView,
  type SyncStatus,
  type SyncTrigger,
} from "./types";
