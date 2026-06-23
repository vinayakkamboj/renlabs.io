"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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

/**
 * Dedicated, branded sign-in for the Ren Labs admin. Separate from the user
 * login so it's clear this is the internal control surface — only allowlisted
 * Ren officials can get past it (the server still enforces admin status after
 * sign-in).
 */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "h-11 w-full rounded-xl border border-carbon-line bg-carbon px-4 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong";

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-dusk">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="size-6 text-brass" />
        <span className="font-serif text-[1.4rem] font-medium tracking-tight">
          Ren Labs
        </span>
        <span className="rounded-full border border-signal-red/40 bg-signal-red/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal-red">
          Internal
        </span>
      </div>
      <h1 className="mt-8 font-serif text-[1.7rem] text-dusk">Admin sign-in</h1>
      <p className="mt-2 max-w-[38ch] text-center text-[13.5px] text-dusk-muted">
        Restricted to Ren Labs officials. Sign in with your authorized account.
      </p>

      {!isSupabaseConfigured() ? (
        <p className="mt-8 max-w-sm rounded-xl border border-carbon-line bg-carbon-raised p-5 text-center text-[13px] text-dusk-muted">
          Auth isn&apos;t configured on this deployment.
        </p>
      ) : (
        <div className="mt-8 w-full max-w-sm">
          <button
            onClick={google}
            disabled={pending}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-carbon-line bg-carbon-raised text-[14px] font-medium text-dusk transition-colors hover:border-carbon-line-strong disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-carbon-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
              or
            </span>
            <span className="h-px flex-1 bg-carbon-line" />
          </div>

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
              <p className="rounded-xl bg-signal-red/10 px-4 py-2.5 text-[13px] text-signal-red">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-xl bg-brass text-[14px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
            >
              {pending ? "Verifying…" : "Sign in"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
