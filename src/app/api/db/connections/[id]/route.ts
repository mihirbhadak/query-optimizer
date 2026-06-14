import { NextResponse, type NextRequest } from "next/server";

import { closeConnection, getConnection } from "@/lib/mysql-runner";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/db/connections/:id — one pool's info. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Disabled." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = getConnection(id);
  if (!info) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, connection: info });
}

/** DELETE /api/db/connections/:id — close the pool (and release its tunnel). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Disabled." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await closeConnection(id);
  return NextResponse.json({ ok: true, ...result });
}
