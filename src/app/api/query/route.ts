import { NextResponse, type NextRequest } from "next/server";

import { runQuery } from "@/lib/mysql/service";
import type { RunQueryRequest } from "@/lib/mysql/types";

// ssh2 + mysql2 need the Node.js runtime (native sockets/crypto), not Edge.
export const runtime = "nodejs";
// Never cache: connection config and queries are per-request.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: RunQueryRequest;
  try {
    body = (await request.json()) as RunQueryRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await runQuery(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
