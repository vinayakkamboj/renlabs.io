/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit OTP via Supabase Admin (so Supabase manages the token),
 * then delivers it through Brevo transactional email instead of Supabase's own
 * mailer. This gives full control over the email template and branding.
 *
 * Only authorised admin emails may request a code. Unknown emails are silently
 * accepted (no enumeration) but won't be able to sign in because Supabase's
 * shouldCreateUser=false will fail at verify time.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY              — Brevo (formerly Sendinblue) v3 API key
 *   BREVO_FROM_EMAIL           — verified sender address (default: noreply@renlabs.io)
 *   BREVO_FROM_NAME            — sender display name (default: Ren Labs)
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["vinayakkamboj01@gmail.com", "vinayak@renlabs.io"];

const BREVO_FROM_EMAIL =
  process.env.BREVO_FROM_EMAIL ?? "noreply@renlabs.io";
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME ?? "Ren Labs";

async function sendBrevoEmail(to: string, code: string): Promise<void> {
  // Trim to defend against a trailing newline/space pasted into the Vercel env UI,
  // which is a common cause of a "set but broken" key.
  const apiKey = process.env.BREVO_API_KEY?.trim();
  console.log(
    "[send-otp] BREVO_API_KEY:",
    apiKey ? `present (len ${apiKey.length})` : "MISSING",
  );
  if (!apiKey) {
    throw new Error(
      "BREVO_API_KEY is not configured. Set it in your environment variables.",
    );
  }

  const body = {
    sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
    to: [{ email: to }],
    subject: `${code} — your Ren Labs admin sign-in code`,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:48px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8b949e;">Ren Labs Admin</p>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#e6edf3;letter-spacing:-.02em;">Sign-in code</h1>
            <p style="margin:0 0 28px;font-size:14px;color:#8b949e;line-height:1.6;">
              Enter this 6-digit code in the admin login screen. It expires in 10 minutes.
            </p>
            <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px 24px;text-align:center;margin-bottom:28px;">
              <span style="font-family:'SF Mono',SFMono-Regular,'Fira Code',Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:.4em;color:#e6edf3;">${code}</span>
            </div>
            <p style="margin:0;font-size:12px;color:#6e7681;line-height:1.6;">
              If you did not request this code, you can safely ignore this email.
              Someone may have entered your address by mistake.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #21262d;">
            <p style="margin:0;font-size:12px;color:#6e7681;">
              Ren Labs &mdash; Restricted to authorised personnel only.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    textContent: `Your Ren Labs admin sign-in code is: ${code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as { message?: string };
      if (json?.message) detail = json.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(`Brevo API error: ${detail}`);
  }
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

  // Reject non-admin emails early — but with the same response shape so we
  // don't enumerate which addresses are registered admins.
  if (!ADMIN_EMAILS.includes(email)) {
    // Artificial delay to slow brute-force enumeration
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    return NextResponse.json({ ok: true });
  }

  // Generate the OTP via Supabase Admin. This does NOT send any email —
  // the admin.generateLink API just creates the token and returns email_otp.
  // Since the caller is already a verified admin email, we surface real error
  // detail here so misconfiguration is debuggable instead of a silent failure.
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error) {
    console.error("[send-otp] generateLink error:", error.message);
    return NextResponse.json(
      { error: `Could not generate a code: ${error.message}` },
      { status: 500 },
    );
  }

  const code = data.properties?.email_otp;
  if (!code) {
    console.error("[send-otp] No email_otp in generateLink response");
    return NextResponse.json(
      {
        error:
          "Supabase did not return an OTP. Ensure email OTP is enabled for this project (Auth → Providers → Email).",
      },
      { status: 500 },
    );
  }

  try {
    await sendBrevoEmail(email, code);
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    console.error("[send-otp] Email delivery failed:", msg);
    // The real Brevo reason (unverified sender, wrong key type, etc.) is the
    // single most useful thing for fixing this — show it to the admin caller.
    return NextResponse.json(
      { error: `Email delivery failed — ${msg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
