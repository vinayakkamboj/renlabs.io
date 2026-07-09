import Link from "next/link";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getMyAccessRequest } from "@/lib/actions/access";
import { RequestAccessForm } from "@/components/platform/request-access-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private beta — Ren",
};

/**
 * Landing page for signed-in users outside the private beta. They can request
 * a trial here; an admin approves it at admin.renlabs.io/access and their very
 * next visit passes the gate. The middleware routes them here from every
 * product surface; the compute APIs refuse them independently, so this page is
 * information, not security.
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
  const request = email ? await getMyAccessRequest() : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carbon px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-carbon-line bg-carbon-raised">
        <Lock className="size-6 text-brass" strokeWidth={1.6} />
      </span>
      <h1 className="mt-6 font-serif text-[1.75rem] leading-tight text-dusk">
        Ren is in private beta
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-dusk-muted">
        Access is limited while we finish the platform{email && (
          <>
            {" "}— you&apos;re signed in as{" "}
            <span className="font-medium text-dusk">{email}</span>
          </>
        )}
        . Request a trial below and we&apos;ll wave you in.
      </p>

      <div className="mt-7 w-full max-w-md">
        {request?.status === "pending" ? (
          <div className="rounded-xl border border-signal-amber/30 bg-signal-amber/[0.08] p-4 text-left">
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-signal-amber">
              <Clock className="size-4" />
              Trial request received
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-dusk-muted">
              We&apos;re reviewing it — the moment it&apos;s approved, signing in
              takes you straight to the dashboard. No further action needed.
            </p>
          </div>
        ) : request?.status === "approved" ? (
          <div className="rounded-xl border border-signal-green/30 bg-signal-green/[0.08] p-4 text-left">
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-signal-green">
              <CheckCircle2 className="size-4" />
              You&apos;re in!
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-dusk-muted">
              Your trial was approved.{" "}
              <Link href="/dashboard" className="text-brass underline-offset-2 hover:underline">
                Open the dashboard →
              </Link>
            </p>
          </div>
        ) : request?.status === "denied" ? (
          <div className="rounded-xl border border-carbon-line bg-carbon-raised p-4 text-left">
            <p className="text-[13.5px] font-medium text-dusk">
              Your request wasn&apos;t approved this round
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-dusk-muted">
              Seats are limited right now. Reach out at{" "}
              <a href="mailto:hello@renlabs.io" className="text-brass hover:underline">
                hello@renlabs.io
              </a>{" "}
              if you think we got this wrong.
            </p>
          </div>
        ) : email ? (
          <RequestAccessForm />
        ) : (
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
          >
            Sign in to request a trial
          </Link>
        )}
      </div>

      <div className="mt-7 flex items-center gap-4">
        <Link
          href="/"
          className="text-[12px] text-dusk-faint underline-offset-2 transition-colors hover:text-dusk-muted hover:underline"
        >
          Back to renlabs.io
        </Link>
        {email && (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-[12px] text-dusk-faint underline-offset-2 transition-colors hover:text-dusk-muted hover:underline"
            >
              Use a different account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
