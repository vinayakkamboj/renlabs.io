"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The OAuth callback origin to use for admin sign-in.
 *
 * Supabase only honours a `redirectTo` that is in its Redirect-URL allowlist;
 * otherwise it silently falls back to the configured Site URL (the home page) —
 * which is exactly the "admin login bounces me to home" bug. The apex domain's
 * callback (`https://example.com/auth/callback`) is always allowlisted because
 * normal user login uses it, while the `admin.` subdomain's callback usually
 * is not. So when we're on an `admin.` host, route OAuth through the apex
 * domain; the callback then redirects to `/admin`, which the same app serves on
 * every host. `NEXT_PUBLIC_APP_URL` overrides this when set.
 */
function adminCallbackBase(): string {
  const origin = location.origin;
  if (origin.includes("://admin.")) {
    return origin.replace("://admin.", "://");
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? origin;
}

type LoginStep = "method" | "otp-sent" | "mfa";

/**
 * Dedicated, branded sign-in for the Ren Labs admin. Supports:
 *  1. Email + password (direct)
 *  2. Email OTP / "sign in with code" (avoids OAuth redirect-allowlist issues)
 *  3. Google OAuth (routes through apex domain callback)
 *  4. TOTP 2FA verification when MFA is enrolled
 */
export function AdminLogin() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("method");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "otp">("password");

  const inputClass =
    "h-11 w-full rounded-xl border border-carbon-line bg-carbon px-4 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong";

  /** After a successful primary auth, check if MFA is required. */
  async function handlePostAuth() {
    const supabase = createClient();
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aalData &&
      aalData.nextLevel === "aal2" &&
      aalData.nextLevel !== aalData.currentLevel
    ) {
      // MFA is enrolled and required — find the TOTP factor
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0] ?? null;
      if (totp) {
        const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
          factorId: totp.id,
        });
        if (challengeErr || !challenge) {
          setError("Could not start 2FA challenge. Try again.");
          setPending(false);
          return;
        }
        setMfaFactorId(totp.id);
        setMfaChallengeId(challenge.id);
        setStep("mfa");
        setPending(false);
        return;
      }
    }
    router.refresh();
  }

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await handlePostAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setPending(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setStep("otp-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !otpCode) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      await handlePostAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
      setPending(false);
    }
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !mfaFactorId || !mfaChallengeId || !mfaCode) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      if (error) throw error;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid 2FA code.");
      setPending(false);
    }
  }

  async function google() {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${adminCallbackBase()}/auth/callback?next=${encodeURIComponent("/admin")}`,
        queryParams: { prompt: "select_account", access_type: "offline" },
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-dusk">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-6 text-brass" />
          <span className="font-serif text-[1.4rem] font-medium tracking-tight">Ren Labs</span>
        </div>
        <p className="mt-8 max-w-sm rounded-xl border border-carbon-line bg-carbon-raised p-5 text-center text-[13px] text-dusk-muted">
          Auth isn&apos;t configured on this deployment.
        </p>
      </div>
    );
  }

  // ── MFA verification step ───────────────────────────────────────────────
  if (step === "mfa") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-dusk">
        <div className="flex items-center gap-2.5">
          <Smartphone className="size-6 text-brass" />
          <span className="font-serif text-[1.4rem] font-medium tracking-tight">Two-factor auth</span>
        </div>
        <p className="mt-3 text-[13.5px] text-dusk-muted">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={verifyMfa} className="mt-8 w-full max-w-sm space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={inputClass + " text-center tracking-[0.4em] text-lg"}
          />
          {error && (
            <p className="rounded-xl bg-signal-red/10 px-4 py-2.5 text-[13px] text-signal-red">{error}</p>
          )}
          <button
            type="submit"
            disabled={pending || mfaCode.length !== 6}
            className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Verify"}
          </button>
        </form>
      </div>
    );
  }

  // ── OTP verification step ───────────────────────────────────────────────
  if (step === "otp-sent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-dusk">
        <div className="flex items-center gap-2.5">
          <KeyRound className="size-6 text-brass" />
          <span className="font-serif text-[1.4rem] font-medium tracking-tight">Enter your code</span>
        </div>
        <p className="mt-3 max-w-[38ch] text-center text-[13.5px] text-dusk-muted">
          We sent a 6-digit code to <strong className="text-dusk">{email}</strong>. Check your inbox.
        </p>
        <form onSubmit={verifyOtp} className="mt-8 w-full max-w-sm space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={inputClass + " text-center tracking-[0.4em] text-lg"}
          />
          {error && (
            <p className="rounded-xl bg-signal-red/10 px-4 py-2.5 text-[13px] text-signal-red">{error}</p>
          )}
          <button
            type="submit"
            disabled={pending || otpCode.length !== 6}
            className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("method"); setOtpCode(""); setError(null); }}
            className="w-full text-[13px] text-dusk-muted underline underline-offset-2 hover:text-dusk"
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  // ── Primary sign-in ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-dusk">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="size-6 text-brass" />
        <span className="font-serif text-[1.4rem] font-medium tracking-tight">Ren Labs</span>
        <span className="rounded-full border border-signal-red/40 bg-signal-red/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal-red">
          Internal
        </span>
      </div>
      <h1 className="mt-8 font-serif text-[1.7rem] text-dusk">Admin sign-in</h1>
      <p className="mt-2 max-w-[38ch] text-center text-[13.5px] text-dusk-muted">
        Restricted to Ren Labs officials. Sign in with your authorized account.
      </p>

      <div className="mt-8 w-full max-w-sm">
        {/* Method tabs */}
        <div className="mb-5 flex rounded-xl border border-carbon-line bg-carbon-raised p-1">
          <button
            onClick={() => { setMode("password"); setError(null); }}
            className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors ${
              mode === "password" ? "bg-carbon text-dusk shadow-sm" : "text-dusk-muted hover:text-dusk"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => { setMode("otp"); setError(null); }}
            className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors ${
              mode === "otp" ? "bg-carbon text-dusk shadow-sm" : "text-dusk-muted hover:text-dusk"
            }`}
          >
            Email code
          </button>
        </div>

        {/* Google */}
        <button
          onClick={google}
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-carbon-line bg-carbon-raised text-[14px] font-medium text-dusk transition-colors hover:border-carbon-line-strong disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-carbon-line" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">or</span>
          <span className="h-px flex-1 bg-carbon-line" />
        </div>

        {mode === "password" ? (
          <form onSubmit={emailSignIn} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@renlabs.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {error && (
              <p className="rounded-xl bg-signal-red/10 px-4 py-2.5 text-[13px] text-signal-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
            >
              {pending ? "Verifying…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={sendOtp} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@renlabs.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <p className="text-[12px] text-dusk-faint">
              We&apos;ll email you a 6-digit sign-in code — no password needed.
            </p>
            {error && (
              <p className="rounded-xl bg-signal-red/10 px-4 py-2.5 text-[13px] text-signal-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={pending || !email}
              className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
