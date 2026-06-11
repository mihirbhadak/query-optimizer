import { NextResponse, type NextRequest } from "next/server";

import { testSshTunnel } from "@/lib/mysql/service";
import type { TestTunnelRequest } from "@/lib/mysql/types";

// ssh2 needs the Node.js runtime (native sockets/crypto), not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: TestTunnelRequest;
  try {
    body = (await request.json()) as TestTunnelRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await testSshTunnel(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
