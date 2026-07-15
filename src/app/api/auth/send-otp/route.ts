/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit code entirely on our backend, stores it in admin_otps,
 * and delivers it via our own SMTP. Verification happens in /api/auth/verify-otp.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isSmtpConfigured } from "@/lib/email/mailer";
import { otpEmail } from "@/lib/email/templates";

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io", "renlabs.io@gmail.com"];

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

  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const supabase = createAdminClient();

  const { error: storeErr } = await supabase
    .from("admin_otps")
    .upsert({ email, code, expires_at: expiresAt });

  if (storeErr) {
    console.error("[send-otp] Failed to store OTP:", storeErr.message);
    return NextResponse.json(
      { error: `Could not create sign-in code: ${storeErr.message}` },
      { status: 500 },
    );
  }

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
    return NextResponse.json({ error: `Email delivery failed: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
