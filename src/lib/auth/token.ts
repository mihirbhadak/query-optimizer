/**
 * Stateless session token: a JSON payload signed with HMAC-SHA256.
 * Format: `<payload b64url>.<signature b64url>`.
 *
 * Dependency-free (node:crypto only) and free of `next/headers`, so it can be
 * used both in server code AND in proxy.ts (Next 16 proxy runs on Node.js).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  /** User id. */
  uid: number;
  /** Expiry, epoch ms. */
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.APP_ENCRYPTION_KEY;
  if (!s) {
    throw new Error(
      "SESSION_SECRET (or APP_ENCRYPTION_KEY) must be set to sign sessions.",
    );
  }
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "qo_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
