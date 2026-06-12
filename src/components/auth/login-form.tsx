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

  return (
    <div>
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
