/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit code entirely on our backend (independent of Supabase's
 * OTP length setting), stores it alongside the hashed_token from generateLink,
 * then delivers the code via our own SMTP. The frontend verifies by POSTing
 * the code to /api/auth/verify-otp, which returns the hashed_token to exchange
 * for a session — so the digit count is always exactly 6, fully backend-controlled.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isSmtpConfigured } from "@/lib/email/mailer";
import { otpEmail } from "@/lib/email/templates";

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io"];

function generate6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

  // 1. generateLink mints a Supabase session token (no email sent). We ignore
  //    email_otp (its length depends on Supabase config) and only take hashed_token
  //    so we can return it during verification to exchange for a real session.
  const { data, error: genError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (genError) {
    console.error("[send-otp] generateLink error:", genError.message);
    return NextResponse.json(
      {
        error:
          `Could not generate a sign-in link: ${genError.message}. ` +
          `(If the user doesn't exist, create ${email} under Supabase → Auth → Users first.)`,
      },
      { status: 500 },
    );
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    console.error("[send-otp] No hashed_token returned from generateLink");
    return NextResponse.json(
      { error: "Supabase did not return a session token. Check Auth → Providers → Email is enabled." },
      { status: 500 },
    );
  }

  // 2. Generate our own 6-digit code and store it with the token hash.
  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: storeErr } = await supabase
    .from("admin_otps")
    .upsert({ email, code, token_hash: tokenHash, expires_at: expiresAt });

  if (storeErr) {
    console.error("[send-otp] Failed to store OTP:", storeErr.message);
    return NextResponse.json(
      { error: `Could not store sign-in code: ${storeErr.message}` },
      { status: 500 },
    );
  }

  // 3. Send the 6-digit code via our own SMTP.
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        error:
          "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS " +
          "(and optionally SMTP_FROM) to your environment.",
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
      { error: `Email delivery failed: ${msg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
