import { NextResponse, type NextRequest } from "next/server";

import { listTunnels, openTunnel } from "@/lib/ssh-tunnel";
import type { OpenTunnelOptions } from "@/lib/ssh-tunnel";
import { dashboardEnabled } from "@/lib/ssh-tunnel/dashboard";

// ssh2 needs the Node.js runtime; the tunnel manager is an in-process singleton.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tunnels — list all live tunnels (secret-free). */
export async function GET() {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Dashboard disabled." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, tunnels: listTunnels() });
}

/** POST /api/tunnels — open (or join) a tunnel. Body: OpenTunnelOptions. */
export async function POST(request: NextRequest) {
  if (!dashboardEnabled()) {
    return NextResponse.json({ ok: false, error: "Dashboard disabled." }, { status: 403 });
  }

  let body: OpenTunnelOptions;
  try {
    body = (await request.json()) as OpenTunnelOptions;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const info = await openTunnel(body);
    return NextResponse.json({ ok: true, tunnel: info }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to open tunnel.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
