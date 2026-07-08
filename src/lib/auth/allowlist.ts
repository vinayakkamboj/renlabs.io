/**
 * Private-beta access allowlist.
 *
 * Ren is currently restricted: only @renlabs.io accounts and explicitly
 * allowlisted emails may use the product (dashboard, workspace, builds,
 * agents). Everyone else can still sign in, but lands on /restricted and is
 * refused by every compute endpoint server-side — the UI gate is convenience,
 * the API gate is the enforcement.
 *
 * Extend without a deploy via env (comma-separated):
 *   REN_ALLOWED_EMAILS="a@b.com,c@d.com"
 *   REN_ALLOWED_DOMAINS="partner.com"
 *
 * Pure string logic only — this runs in the edge middleware.
 */

const BASE_ALLOWED_EMAILS = ["vinayakkamboj01@gmail.com"];
const BASE_ALLOWED_DOMAINS = ["renlabs.io"];

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True when this email may use the Ren product surfaces. */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";

  const emails = [...BASE_ALLOWED_EMAILS, ...envList("REN_ALLOWED_EMAILS")];
  const domains = [...BASE_ALLOWED_DOMAINS, ...envList("REN_ALLOWED_DOMAINS")];

  return emails.includes(normalized) || domains.includes(domain);
}
