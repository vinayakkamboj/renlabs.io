/**
 * POST /api/auth/send-otp
 *
 * Sends a magic-link OTP to the admin's email.
 *
 * With Supabase SMTP configured:
 *   signInWithOtp → Supabase generates the 6-digit code → sends via YOUR SMTP
 *   using the template you set in Supabase Auth → Email Templates → Magic Link.
 *
 * The HTML template to paste into Supabase is in /docs/supabase-otp-template.html
 *
 * Required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   Supabase Auth → Email → SMTP configured
 *   Supabase Auth → Email Templates → Magic Link → paste the branded template
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

  // Non-admin emails: fake success to prevent enumeration.
  if (!ADMIN_EMAILS.includes(email)) {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    return NextResponse.json({ ok: true });
  }

  // signInWithOtp: Supabase generates the OTP and delivers it via the SMTP
  // you configured in the dashboard — fully your own mail server, your template.
  const supabase = createAdminClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[send-otp] error:", error.message);

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
      { error: `Could not send code: ${error.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
