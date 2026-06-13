import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RenMark } from "@/components/ui/wordmark";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Ren Code — create a workspace, connect GitHub, and start building.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <Link href="/" aria-label="Ren AI home" className="text-ink transition-opacity hover:opacity-70">
        <RenMark className="size-9 text-bronze" />
      </Link>

      <h1 className="mt-10 font-serif text-display font-normal text-ink">
        Start building.
      </h1>
      <p className="mt-4 max-w-[42ch] text-center text-[15px] leading-relaxed text-graphite">
        Sign in to Ren Code to create a workspace, connect a repository, and let
        Astra do engineering you can review.
      </p>

      <div className="mt-10 w-full max-w-sm">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
        Ren AI · Ren Code
      </p>
    </div>
  );
}
