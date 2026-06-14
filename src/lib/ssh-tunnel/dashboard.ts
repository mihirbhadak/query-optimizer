/**
 * Access guard for the TEMPORARY tunnel dashboard + its API.
 *
 * The dashboard creates SSH connections from raw credentials and has no auth of
 * its own yet, so it must not be reachable in production by accident. It is
 * enabled in development, and in production only when explicitly opted in via
 * ENABLE_TUNNEL_DASHBOARD=true. Replace this with real admin auth later.
 */
export function dashboardEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_TUNNEL_DASHBOARD === "true";
}
