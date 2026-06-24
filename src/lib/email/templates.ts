/**
 * Branded email templates. Inline-styled HTML (email clients ignore <style> in
 * many cases and strip classes), built from the Ren Labs design tokens so email
 * matches the admin UI: carbon surfaces, dusk text, brass accent, serif display.
 */

export interface OtpEmail {
  subject: string;
  html: string;
  text: string;
}

/** The admin sign-in OTP email. `code` is the 6-digit token. */
export function otpEmail(code: string): OtpEmail {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Your Ren Labs sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#161513;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#161513;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;width:100%;background:#1d1c19;border:1px solid #2b2925;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:30px 40px 26px;border-bottom:1px solid #2b2925;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:middle;padding-right:9px;">
                          <!-- Ren mark: open reasoning loop -->
                          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                            <path d="M27.5 12.4A12 12 0 1 0 28 16" stroke="#c9ad79" stroke-width="2.6" stroke-linecap="round"/>
                            <circle cx="28" cy="9.4" r="1.9" fill="#c9ad79"/>
                          </svg>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:Georgia,'Iowan Old Style',serif;font-size:17px;font-weight:500;color:#e9e4d8;letter-spacing:-.01em;">Ren Labs</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 11px;border:1px solid rgba(179,100,92,0.28);background:rgba(179,100,92,0.10);border-radius:999px;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;font-size:9px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#b3645c;">Internal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:38px 40px 34px;">
              <p style="margin:0 0 8px;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:#6b665a;">Admin sign-in</p>
              <h1 style="margin:0 0 18px;font-family:Georgia,'Iowan Old Style',serif;font-size:25px;font-weight:600;color:#e9e4d8;letter-spacing:-.02em;line-height:1.2;">Your sign-in code</h1>
              <p style="margin:0 0 30px;font-size:14px;color:#97917f;line-height:1.65;">
                Enter this 6-digit code on the Ren Labs admin login screen.
                It expires in <strong style="color:#e9e4d8;font-weight:600;">10 minutes</strong>.
              </p>

              <!-- Code -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:30px;">
                <tr>
                  <td style="background:#161513;border:1px solid #2b2925;border-radius:12px;padding:26px 24px;text-align:center;">
                    <span style="font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:42px;font-weight:700;letter-spacing:.34em;color:#e9e4d8;padding-left:.34em;">${code}</span>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#24221e;border:1px solid #2b2925;border-radius:10px;padding:16px 20px;">
                    <p style="margin:0;font-size:12.5px;color:#6b665a;line-height:1.6;">
                      <strong style="color:#97917f;font-weight:600;">Didn't request this?</strong>
                      You can safely ignore this email — someone may have entered your address by mistake. Your account is secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #2b2925;">
              <p style="margin:0;font-size:12px;color:#6b665a;">Ren Labs &mdash; Restricted to authorised personnel only.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your Ren Labs admin sign-in code: ${code}

This code expires in 10 minutes. If you did not request this, ignore this email.

— Ren Labs (restricted to authorised personnel only)`;

  return {
    subject: `${code} — your Ren Labs sign-in code`,
    html,
    text,
  };
}
