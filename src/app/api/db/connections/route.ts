import { NextResponse, type NextRequest } from "next/server";

import { ensureConnection, listConnections } from "@/lib/mysql-runner";
import type { OpenConnectionOptions } from "@/lib/mysql-runner";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/db/connections — list all live pools (secret-free). */
export async function GET() {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Disabled." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, connections: listConnections() });
}

/** POST /api/db/connections — open/reuse a pool without running a query. */
export async function POST(request: NextRequest) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Disabled." }, { status: 403 });
  }

  let body: OpenConnectionOptions;
  try {
    body = (await request.json()) as OpenConnectionOptions;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const info = await ensureConnection(body);
    return NextResponse.json({ ok: true, connection: info }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open connection.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
