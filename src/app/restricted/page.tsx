import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private beta — Ren",
};

/**
 * Landing page for signed-in users outside the private-beta allowlist.
 * The middleware routes them here from every product surface; the compute
 * APIs refuse them independently, so this page is information, not security.
 */
export default async function RestrictedPage() {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-carbon-line bg-carbon-raised">
        <Lock className="size-6 text-brass" strokeWidth={1.6} />
      </span>
      <h1 className="mt-6 font-serif text-[1.75rem] leading-tight text-dusk">
        Ren is in private beta
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-dusk-muted">
        Access is currently limited to invited accounts while we finish the
        platform.{email && (
          <>
            {" "}You&apos;re signed in as{" "}
            <span className="font-medium text-dusk">{email}</span>, which
            isn&apos;t on the list yet.
          </>
        )}{" "}
        Want in? Reach out and we&apos;ll add you.
      </p>
      <div className="mt-7 flex items-center gap-3">
        <a
          href="mailto:hello@renlabs.io?subject=Ren%20beta%20access"
          className="flex h-10 items-center rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
        >
          Request access
        </a>
        <Link
          href="/"
          className="flex h-10 items-center rounded-lg border border-carbon-line px-5 text-[13px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
        >
          Back to renlabs.io
        </Link>
      </div>
      <form action="/auth/signout" method="post" className="mt-5">
        <button
          type="submit"
          className="text-[12px] text-dusk-faint underline-offset-2 transition-colors hover:text-dusk-muted hover:underline"
        >
          Sign out and use a different account
        </button>
      </form>
    </div>
  );
}
