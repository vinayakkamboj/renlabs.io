/**
 * POST /api/auth/send-otp
 *
 * Sends a 6-digit OTP to the requested email via Supabase's configured email
 * provider (custom SMTP when set in Supabase → Auth → Email). No Brevo, no
 * generateLink — one call, no rate-limit conflicts.
 *
 * Only authorised admin emails receive a real code. Unknown addresses are
 * accepted with a fake-success response to prevent enumeration.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   (+ Supabase Auth → Email → SMTP configured in the Supabase dashboard)
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Non-admin emails get a fake-success so we don't enumerate authorised addresses.
  if (!ADMIN_EMAILS.includes(email)) {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    return NextResponse.json({ ok: true });
  }

  // Send OTP via Supabase — uses whatever email provider is configured in the
  // Supabase dashboard (custom SMTP, Resend, etc). One call = one code, no
  // rate-limit conflict from a prior generateLink call.
  const supabase = createAdminClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[send-otp] signInWithOtp error:", error.message);

    const isRateLimit =
      /after \d+ second/i.test(error.message) ||
      /rate.?limit/i.test(error.message);

    if (isRateLimit) {
      return NextResponse.json(
        { error: "A code was just sent. Please wait 60 seconds before requesting another." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: `Could not send code: ${error.message}. ` +
          `Check Supabase → Auth → Email → SMTP settings are configured.`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
