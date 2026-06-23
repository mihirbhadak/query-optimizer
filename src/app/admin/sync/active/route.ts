import { getCurrentUser, getRoleNames } from "@/lib/auth/dal";
import { syncManager } from "@/lib/db-introspect";

/** All active (queued/running) schema-sync jobs, for the dashboard widget. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !getRoleNames(user.id).includes("admin")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ jobs: syncManager.listActive() });
}
