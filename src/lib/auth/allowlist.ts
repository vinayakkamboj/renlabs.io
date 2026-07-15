/**
 * Private-beta access allowlist (only consulted when REN_PRIVATE_BETA=1).
 *
 * Ren is OPEN by default — anyone can create an account and build, with their
 * first generation free. When the private-beta switch is on, only @renlabs.io
 * accounts, explicitly allowlisted emails, and admin-approved trial requests
 * may use the product; everyone else lands on /restricted and is refused by
 * every compute endpoint server-side.
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
