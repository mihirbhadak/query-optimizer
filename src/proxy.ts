import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

// Public routes (no session required). Everything else requires a session.
const PUBLIC = ["/login", "/signup", "/setup"];

function isPublic(path: string): boolean {
  return PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Optimistic auth gate (Next 16 "proxy", formerly middleware). Only reads the
 * signed cookie — no DB — and redirects. The real, secure check runs in the DAL
 * (src/lib/auth/dal.ts) inside Server Components/Actions.
 */
export function proxy(req: NextRequest): NextResponse {
  const path = req.nextUrl.pathname;
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Not signed in and hitting a protected route -> login.
  if (!session && !isPublic(path)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  // Already signed in and hitting an auth page -> home.
  if (session && isPublic(path)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes except API, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico)$).*)"],
};
