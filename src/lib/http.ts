/** Request helpers for Server Actions / Route Handlers. */

import { headers } from "next/headers";

/** Best-effort client IP from proxy headers (for audit logging). */
export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return h.get("x-real-ip") ?? undefined;
}
