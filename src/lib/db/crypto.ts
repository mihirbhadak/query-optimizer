/**
 * AES-256-GCM encryption for secret fields stored in the internal DB
 * (DB passwords, SSH keys/passphrases). Plaintext secrets never touch disk.
 *
 * Key: APP_ENCRYPTION_KEY — 32 bytes, hex (64 chars) or base64. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format: `v1.<iv b64>.<tag b64>.<ciphertext b64>`.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate one with " +
        '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
        "and put it in your environment to store/read encrypted secrets.",
    );
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (hex of 64 chars, or base64).");
  }
  cachedKey = buf;
  return buf;
}

/** Encrypt a UTF-8 string. Returns the versioned, self-describing blob. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

/** Decrypt a blob produced by `encryptSecret`. */
export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed or unsupported encrypted secret.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString(
    "utf8",
  );
}

/** Convenience: encrypt only when a value is present. */
export function encryptOptional(value: string | null | undefined): string | null {
  return value ? encryptSecret(value) : null;
}

export function decryptOptional(blob: string | null | undefined): string | undefined {
  return blob ? decryptSecret(blob) : undefined;
}

/** True if the encryption key is configured (without throwing). */
export function hasEncryptionKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
