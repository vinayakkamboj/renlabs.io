/**
 * SMTP mailer — sends transactional email directly from our backend using the
 * SMTP credentials configured for this deployment. This is fully under our
 * control (own template, own send), independent of Supabase's email service.
 *
 * Configure these env vars (copy the values from your Supabase SMTP settings —
 * they're the same credentials, since that SMTP already works):
 *   SMTP_HOST       e.g. smtp.resend.com, smtp.gmail.com, smtp-relay.brevo.com
 *   SMTP_PORT       587 (STARTTLS) or 465 (implicit TLS)
 *   SMTP_USER       SMTP username
 *   SMTP_PASS       SMTP password / API key
 *   SMTP_FROM       sender, e.g. "Ren Labs <noreply@renlabs.io>"
 *
 * NEVER import this from a client component.
 */

import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

/** Lazily build a transporter so a missing config doesn't crash module load. */
function getTransport() {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; 587/25 = STARTTLS (secure:false, upgraded via STARTTLS).
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

function defaultFrom(): string {
  return process.env.SMTP_FROM ?? "Ren Labs <noreply@renlabs.io>";
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email via SMTP. Throws a descriptive error on failure so callers can
 * surface the real reason (bad auth, unverified sender, connection refused, …).
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS " +
        "(and optionally SMTP_FROM) in your environment.",
    );
  }
  const transport = getTransport();
  await transport.sendMail({
    from: defaultFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
