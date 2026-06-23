"use client";

/**
 * Admin security page — TOTP 2FA enrollment and management.
 * Admins can enroll a TOTP device (Google Authenticator, Authy, etc.),
 * verify it, and unenroll if needed.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, QrCode, Shield, ShieldOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: "verified" | "unverified";
  created_at: string;
}

type EnrollStep = "idle" | "scanning" | "verifying" | "done";

export function AdminSecurityClient() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrollStep, setEnrollStep] = useState<EnrollStep>("idle");
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  async function loadFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as TotpFactor[]);
  }

  async function startEnroll() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Ren Labs Admin",
      });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      // Start the challenge immediately so we're ready to verify
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: data.id,
      });
      if (challengeErr || !challenge) throw challengeErr ?? new Error("Challenge failed");
      setChallengeId(challenge.id);
      setEnrollStep("scanning");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed.");
    } finally {
      setPending(false);
    }
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollData || !challengeId || !verifyCode) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId,
        code: verifyCode,
      });
      if (error) throw error;
      setEnrollStep("done");
      setSuccess("2FA enrolled successfully. You'll be prompted for a code on every sign-in.");
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function unenroll(factorId: string) {
    if (!confirm("Remove 2FA? You'll be able to sign in without a code until you re-enroll.")) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setSuccess("2FA removed.");
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove 2FA.");
    } finally {
      setPending(false);
    }
  }

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const inputClass =
    "h-11 w-full rounded-xl border border-carbon-line bg-carbon px-4 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">Security</h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          Manage your admin account security settings.
        </p>
      </div>

      {/* 2FA section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-dusk-faint" />
          <h2 className="font-serif text-[1.2rem] text-dusk">Two-factor authentication</h2>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-signal-green/10 px-4 py-3 text-[13px] text-signal-green">
            <CheckCircle2 className="size-4 shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-signal-red/10 px-4 py-3 text-[13px] text-signal-red">
            {error}
          </div>
        )}

        {verifiedFactor ? (
          <div className="flex items-center justify-between rounded-2xl border border-carbon-line bg-carbon-raised p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-signal-green/10">
                <Shield className="size-5 text-signal-green" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-dusk">2FA is active</p>
                <p className="text-[12.5px] text-dusk-muted">
                  {verifiedFactor.friendly_name ?? "Authenticator app"} · enrolled{" "}
                  {new Date(verifiedFactor.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => unenroll(verifiedFactor.id)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-signal-red/30 px-3 py-1.5 text-[12.5px] text-signal-red transition-colors hover:bg-signal-red/10 disabled:opacity-50"
            >
              <ShieldOff className="size-3.5" />
              Remove
            </button>
          </div>
        ) : enrollStep === "idle" ? (
          <div className="flex items-center justify-between rounded-2xl border border-carbon-line bg-carbon-raised p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-carbon-line bg-carbon">
                <Shield className="size-5 text-dusk-faint" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-dusk">2FA not enabled</p>
                <p className="text-[12.5px] text-dusk-muted">
                  Protect your admin account with Google Authenticator or Authy.
                </p>
              </div>
            </div>
            <button
              onClick={startEnroll}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-2 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
            >
              <QrCode className="size-3.5" />
              {pending ? "Setting up…" : "Set up 2FA"}
            </button>
          </div>
        ) : enrollStep === "scanning" ? (
          <div className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 space-y-5">
            <div>
              <p className="text-[14px] font-medium text-dusk">Scan this QR code</p>
              <p className="mt-1 text-[13px] text-dusk-muted">
                Open Google Authenticator (or Authy) and scan the code below.
              </p>
            </div>
            {enrollData?.qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrollData.qrCode}
                  alt="2FA QR code"
                  className="size-48 rounded-xl border border-carbon-line bg-white p-2"
                />
              </div>
            )}
            <div>
              <p className="mb-1 text-[12px] text-dusk-faint">Or enter the secret manually:</p>
              <code className="block rounded-lg border border-carbon-line bg-carbon px-3 py-2 font-mono text-[12px] text-brass break-all">
                {enrollData?.secret}
              </code>
            </div>
            <form onSubmit={verifyEnroll} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] text-dusk-muted">
                  Enter the 6-digit code to confirm
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={inputClass + " text-center tracking-[0.4em] text-lg"}
                />
              </div>
              <button
                type="submit"
                disabled={pending || verifyCode.length !== 6}
                className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
              >
                {pending ? "Verifying…" : "Confirm & enable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => { setEnrollStep("idle"); setEnrollData(null); setError(null); }}
                className="w-full text-[13px] text-dusk-muted underline underline-offset-2 hover:text-dusk"
              >
                Cancel
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-signal-green/30 bg-signal-green/10 p-5">
            <CheckCircle2 className="size-6 shrink-0 text-signal-green" />
            <div>
              <p className="text-[14px] font-medium text-dusk">2FA is now active</p>
              <p className="text-[12.5px] text-dusk-muted">
                You&apos;ll be asked for your authenticator code each time you sign in.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
