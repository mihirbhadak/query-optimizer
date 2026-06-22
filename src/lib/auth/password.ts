/**
 * Password hashing with Node's built-in scrypt — no external dependency.
 * Stored format: `scrypt$<saltHex>$<hashHex>`.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(plaintext: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, KEYLEN, PARAMS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plaintext: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plaintext, Buffer.from(saltHex, "hex"), KEYLEN, PARAMS);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
