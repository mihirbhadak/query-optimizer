import { NextResponse, type NextRequest } from "next/server";

import { closeTunnel, getTunnel } from "@/lib/ssh-tunnel";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/tunnels/:id — one tunnel's info. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Dashboard disabled." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const info = getTunnel(id);
  if (!info) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, tunnel: info });
}

/** DELETE /api/tunnels/:id[?force=true] — release a ref; close at zero (or force). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Dashboard disabled." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const result = await closeTunnel(id, force);
  return NextResponse.json({ ok: true, ...result });
}
