/**
 * GitHub OAuth session management.
 *
 * The access token is encrypted with AES-256-GCM and stored in an httpOnly
 * cookie named `ren_github_session`. CSRF state is stored in a separate
 * httpOnly cookie named `ren_github_oauth_state`.
 *
 * This is completely separate from Supabase auth. Users first authenticate
 * via Supabase (Google / email), then separately connect their GitHub account
 * here to grant repository read/write access to Ren Code.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import type { NextResponse } from "next/server";

/** Structural cookie reader satisfied by both `await cookies()` and request cookies. */
interface CookieReader {
  get(name: string): { value: string } | undefined;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_COOKIE = "ren_github_session";
const STATE_COOKIE = "ren_github_oauth_state";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GitHubSession {
  accessToken: string;
  login: string;
  scope: string;
  connectedAt: string; // ISO 8601
}

export interface GitHubOAuthState {
  csrf: string;
  returnTo: string;
  issuedAt: number;
}

// ─── Configuration check ─────────────────────────────────────────────────────

export function isGitHubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
}

// ─── Key derivation ──────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const secret =
    process.env.GITHUB_SESSION_SECRET ||
    process.env.GITHUB_CLIENT_SECRET ||
    "";

  if (!secret) {
    throw new Error(
      "GITHUB_SESSION_SECRET or GITHUB_CLIENT_SECRET must be set to encrypt GitHub sessions.",
    );
  }

  // Derive a 32-byte key from whatever-length secret via SHA-256
  return createHash("sha256").update(secret).digest();
}

// ─── Encrypt / decrypt ───────────────────────────────────────────────────────

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: iv(12) + tag(16) + ciphertext — all base64url
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64url");

  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext: too short");
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data) + decipher.final("utf8");
}

// ─── OAuth state ─────────────────────────────────────────────────────────────

/**
 * Create a new CSRF state object for an OAuth flow.
 * `returnTo` is where to send the user after the OAuth callback completes.
 */
export function createOAuthState(returnTo: string): GitHubOAuthState {
  return {
    csrf: randomBytes(32).toString("hex"),
    returnTo: normalizeReturnTo(returnTo),
    issuedAt: Date.now(),
  };
}

/** Encode a state object as an encrypted base64url string for the cookie and
 *  the `state` query param sent to GitHub. */
export function encodeOAuthState(state: GitHubOAuthState): string {
  return encrypt(JSON.stringify(state));
}

/** Decode an encrypted state string back to the state object. Throws if
 *  tampered or malformed. */
export function decodeOAuthState(value: string): GitHubOAuthState {
  const raw = decrypt(value);
  const parsed = JSON.parse(raw) as GitHubOAuthState;
  if (!parsed.csrf || !parsed.returnTo || !parsed.issuedAt) {
    throw new Error("Invalid OAuth state");
  }
  return parsed;
}

/**
 * Timing-safe comparison of the CSRF token from the callback against the one
 * stored in the cookie. Checks age (must be issued within 10 minutes) too.
 */
export function statesMatch(
  fromCookie: GitHubOAuthState,
  fromCallback: GitHubOAuthState,
): boolean {
  const ageMs = Date.now() - fromCookie.issuedAt;
  if (ageMs > 10 * 60 * 1000) return false; // expired

  const a = Buffer.from(fromCookie.csrf, "hex");
  const b = Buffer.from(fromCallback.csrf, "hex");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

// ─── Session cookie helpers ───────────────────────────────────────────────────

/** Read and decrypt the GitHub session from the request cookies. Returns null
 *  if absent or tampered. */
export function readGitHubSession(
  cookieStore: CookieReader,
): GitHubSession | null {
  try {
    const value = cookieStore.get(SESSION_COOKIE)?.value;
    if (!value) return null;
    return JSON.parse(decrypt(value)) as GitHubSession;
  } catch {
    return null;
  }
}

/** Write the encrypted session to an httpOnly cookie on the response. */
export function setSessionCookie(
  response: NextResponse,
  session: GitHubSession,
): void {
  const encoded = encrypt(JSON.stringify(session));
  response.cookies.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Clear the GitHub session cookie. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ─── State cookie helpers ────────────────────────────────────────────────────

/** Write the encrypted OAuth state to an httpOnly cookie. */
export function setStateCookie(
  response: NextResponse,
  state: GitHubOAuthState,
): void {
  const encoded = encodeOAuthState(state);
  response.cookies.set(STATE_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });
}

/** Clear the OAuth state cookie. */
export function clearStateCookie(response: NextResponse): void {
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read and decode the OAuth state from the request cookies. Returns null if
 *  absent or tampered. */
export function readStateCookie(
  cookieStore: CookieReader,
): GitHubOAuthState | null {
  try {
    const value = cookieStore.get(STATE_COOKIE)?.value;
    if (!value) return null;
    return decodeOAuthState(value);
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ensure returnTo is a safe internal path (no open redirects).
 * Falls back to /dashboard/integrations.
 */
export function normalizeReturnTo(value: string | null | undefined): string {
  const fallback = "/dashboard/integrations";
  if (!value) return fallback;
  // Must start with "/" and not be a protocol-relative URL
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}
