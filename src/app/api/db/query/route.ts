import { NextResponse, type NextRequest } from "next/server";

import { runQuery } from "@/lib/mysql-runner";
import type { RunQueryOptions } from "@/lib/mysql-runner";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

// mysql2 + ssh2 need the Node.js runtime; the manager is an in-process singleton.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/db/query — open/reuse a pool and run a query. Body: RunQueryOptions. */
export async function POST(request: NextRequest) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Disabled." }, { status: 403 });
  }

  let body: RunQueryOptions;
  try {
    body = (await request.json()) as RunQueryOptions;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await runQuery(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
