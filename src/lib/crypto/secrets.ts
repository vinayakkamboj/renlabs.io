/**
 * Symmetric encryption for credentials stored at rest.
 *
 * Used to protect third-party secrets (e.g. a user's Supabase service-role key)
 * before they are written to the database. Even though RLS already restricts a
 * row to its owner, encrypting the value means a database dump or a misconfigured
 * policy never leaks a usable key.
 *
 * The key is derived from `INTEGRATION_ENCRYPTION_KEY` (a server-only secret).
 * If that env var is absent, we fall back to storing plaintext (still
 * RLS-protected) so local development keeps working — production deployments
 * MUST set the variable. NEVER import this from client code.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < 8) return null;
  // Derive a stable 32-byte key from the configured secret.
  return scryptSync(secret, "ren-integrations-salt", 32);
}

/** True when a real encryption key is configured (production posture). */
export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/**
 * Encrypt a secret. Returns an `enc:v1:<iv>:<tag>:<data>` string when a key is
 * configured, otherwise returns the plaintext unchanged (dev fallback).
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/**
 * Decrypt a value produced by `encryptSecret`. Plaintext (un-prefixed) values
 * pass through unchanged so legacy rows and the dev fallback both work.
 */
export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return ""; // ciphertext present but no key — cannot recover
  try {
    const [, , ivB64, tagB64, dataB64] = value.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
