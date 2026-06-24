/**
 * POST /api/auth/verify-otp
 *
 * Verifies the 6-digit code against our admin_otps table, then returns the
 * hashed_token so the client can exchange it for a Supabase session via
 * supabase.auth.verifyOtp({ token_hash, type: "magiclink" }).
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
    .select("code, token_hash, expires_at")
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

  // Code is valid — delete it (single use) and return the token hash.
  await supabase.from("admin_otps").delete().eq("email", email);

  return NextResponse.json({ token_hash: row.token_hash });
}
