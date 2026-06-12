import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RenMark } from "@/components/ui/wordmark";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Ren research platform.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <Link href="/" aria-label="Ren AI home" className="text-ink transition-opacity hover:opacity-70">
        <RenMark className="size-9 text-bronze" />
      </Link>

      <h1 className="mt-10 font-serif text-display font-normal text-ink">
        Welcome back.
      </h1>
      <p className="mt-4 max-w-[40ch] text-center text-[15px] leading-relaxed text-graphite">
        Sign in to reach the research platform. Access is for the Ren team —
        the research itself is public.
      </p>

      <div className="mt-10 w-full max-w-sm">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
        Ren AI · internal access
      </p>
    </div>
  );
}
