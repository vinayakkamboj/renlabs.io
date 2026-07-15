/**
 * POST /api/auth/verify-otp
 *
 * Checks the 6-digit code against admin_otps, then calls generateLink fresh
 * to get a live action_link. The client navigates to that URL, Supabase
 * redirects back to /auth/callback with a code, and exchangeCodeForSession
 * creates the session — no stale tokens.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io", "renlabs.io@gmail.com"];

export async function POST(req: Request) {
  let email: string;
  let code: string;
  try {
    const body = (await req.json()) as { email?: unknown; code?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    if (typeof body.code !== "string" || body.code.length !== 6) {
      return NextResponse.json({ error: "Code must be 6 digits." }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
    code = body.code.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: row, error: fetchErr } = await supabase
    .from("admin_otps")
    .select("code, expires_at")
    .eq("email", email)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  if (new Date(row.expires_at) < new Date()) {
    await supabase.from("admin_otps").delete().eq("email", email);
    return NextResponse.json({ error: "Code has expired. Request a new one." }, { status: 400 });
  }

  if (row.code !== code) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  // Code is valid — delete it (single use).
  await supabase.from("admin_otps").delete().eq("email", email);

  // Generate a fresh Supabase OTP. We return the email_otp so the frontend can
  // call supabase.auth.verifyOtp({ email, token, type: "email" }) directly —
  // no redirects, no redirect-URL allowlist issues, session created on the
  // correct domain right in the browser.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr || !linkData.properties?.email_otp) {
    console.error("[verify-otp] generateLink error:", linkErr?.message);
    return NextResponse.json(
      { error: "Code verified but could not create session token. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ otp: linkData.properties.email_otp });
}
