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

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io"];

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

  // Generate a fresh magic link right now. The action_link is live immediately
  // and the client navigates to it, which redirects back to /auth/callback.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  });

  if (linkErr || !linkData.properties?.action_link) {
    console.error("[verify-otp] generateLink error:", linkErr?.message);
    return NextResponse.json(
      { error: "Code verified but could not create session link. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ action_link: linkData.properties.action_link });
}
