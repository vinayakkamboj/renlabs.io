/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit OTP via Supabase Admin and sends it ourselves over SMTP.
 * This deliberately does NOT use Supabase's email service — admin.generateLink
 * only mints the token (no email), and we deliver our own branded email through
 * our own SMTP transport. That way "Error sending magic link email" from
 * Supabase's mailer can never block admin sign-in, and the email always matches
 * our design.
 *
 * The client then verifies with supabase.auth.verifyOtp({ email, token, type:
 * "email" }) — the same code we generated here.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  (copy from your Supabase SMTP)
 *   SMTP_FROM   (optional, e.g. "Ren Labs <noreply@renlabs.io>")
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isSmtpConfigured } from "@/lib/email/mailer";
import { otpEmail } from "@/lib/email/templates";

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io"];

export async function POST(req: Request) {
  let email: string;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Non-admin emails: fake success to prevent enumeration.
  if (!ADMIN_EMAILS.includes(email)) {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  // 1. Mint the OTP server-side. generateLink does NOT send any email — it only
  //    returns the token (email_otp) for us to deliver however we want.
  const { data, error: genError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (genError) {
    console.error("[send-otp] generateLink error:", genError.message);
    return NextResponse.json(
      {
        error:
          `Could not generate a code: ${genError.message}. ` +
          `(If this says the user doesn't exist, create ${email} under ` +
          `Supabase → Auth → Users first.)`,
      },
      { status: 500 },
    );
  }

  const code = data.properties?.email_otp;
  if (!code) {
    console.error("[send-otp] No email_otp returned from generateLink");
    return NextResponse.json(
      {
        error:
          "Supabase did not return an OTP. Enable Email OTP under " +
          "Auth → Providers → Email.",
      },
      { status: 500 },
    );
  }

  // 2. Send our own branded email via our own SMTP.
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        error:
          "SMTP is not configured for the app. Add SMTP_HOST, SMTP_PORT, " +
          "SMTP_USER, SMTP_PASS (and SMTP_FROM) to your environment — use the " +
          "same values as your Supabase SMTP settings.",
      },
      { status: 500 },
    );
  }

  try {
    const { subject, html, text } = otpEmail(code);
    await sendMail({ to: email, subject, html, text });
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    console.error("[send-otp] SMTP send failed:", msg);
    return NextResponse.json(
      { error: `Email delivery failed over SMTP: ${msg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
