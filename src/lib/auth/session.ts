/** Cookie-backed session management (server-only — uses next/headers). */

import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_MAX_AGE_MS, signSession, verifySessionToken } from "./token";
import type { SessionPayload } from "./token";

export async function startSession(userId: number): Promise<void> {
  const exp = Date.now() + SESSION_MAX_AGE_MS;
  const token = signSession({ uid: userId, exp });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Allow the cookie over http in dev; require https in production.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
