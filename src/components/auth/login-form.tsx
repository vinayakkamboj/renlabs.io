"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const inputClasses =
  "h-11 w-full rounded-xl border border-line-strong bg-paper-raised px-4 text-[14.5px] text-ink outline-none transition-all duration-300 placeholder:text-graphite-soft focus:border-stone focus:shadow-lift";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-line bg-paper-deep/60 p-7 text-center">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
          Auth not configured
        </p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-graphite">
          Authentication switches on once{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[12px]">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[12px]">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          are set. Until then the platform is open in demo mode.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setNotice("Check your email to confirm the account, then sign in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function magicLink() {
    if (pending || !email) {
      setError(email ? null : "Enter your email first, then request a link.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setPending(false);
    if (error) setError(error.message);
    else setNotice("Magic link sent — check your email.");
  }

  async function oauth(provider: "google" | "github") {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Force Google to always show the account chooser + consent screen,
        // instead of silently signing the user straight through when they are
        // already logged into Google and have approved the app before.
        ...(provider === "google"
          ? {
              queryParams: {
                prompt: "select_account consent",
                access_type: "offline",
              },
            }
          : {}),
        ...(provider === "github" ? { scopes: "read:user user:email" } : {}),
      },
    });
    if (error) {
      setPending(false);
      setError(error.message);
    }
    // On success the browser is redirected to the provider.
  }

  return (
    <div>
      {/* OAuth providers */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => oauth("google")}
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-paper-raised text-sm font-medium tracking-tight text-ink transition-all duration-300 hover:border-stone hover:bg-paper-deep disabled:opacity-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => oauth("github")}
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-ink text-sm font-medium tracking-tight text-paper transition-all duration-300 hover:bg-ink-soft disabled:opacity-50"
        >
          <GithubIcon />
          Continue with GitHub
        </button>
      </div>

      <div className="my-5 flex items-center gap-4">
        <span className="rule flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-soft">
          or with email
        </span>
        <span className="rule flex-1" />
      </div>

      {/* Mode switch */}
      <div className="grid grid-cols-2 rounded-full border border-line bg-paper-deep/50 p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className={cn(
              "h-9 rounded-full text-[13px] font-medium tracking-tight transition-all duration-300",
              mode === m ? "bg-ink text-paper" : "text-graphite hover:text-ink",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@ren.ai"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClasses}
        />

        {error && (
          <p className="rounded-xl bg-signal-red/10 px-4 py-3 text-[13px] leading-relaxed text-signal-red">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-bronze-wash px-4 py-3 text-[13px] leading-relaxed text-bronze-deep">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-full bg-ink text-sm font-medium tracking-tight text-paper transition-all duration-300 hover:bg-ink-soft disabled:opacity-50"
        >
          {pending ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-4">
        <span className="rule flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-soft">
          or
        </span>
        <span className="rule flex-1" />
      </div>

      <button
        type="button"
        onClick={magicLink}
        disabled={pending}
        className="mt-5 h-11 w-full rounded-full border border-line-strong text-sm font-medium tracking-tight text-ink transition-all duration-300 hover:border-stone hover:bg-paper-deep disabled:opacity-50"
      >
        Email me a magic link
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
