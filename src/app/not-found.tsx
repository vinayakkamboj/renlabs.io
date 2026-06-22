import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";

export const metadata: Metadata = {
  title: "Lost · Ren Labs",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper px-6 py-20 text-center">
      {/* faint dotted grid wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(27 26 23 / 0.06) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 60% 55% at 50% 42%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 55% at 50% 42%, black, transparent)",
        }}
      />

      <div className="relative">
        <Sticker label="oops!" className="mb-12" />

        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-graphite-soft">
          Error 404
        </p>
        <h1 className="mt-4 max-w-[22ch] font-serif text-display font-normal tracking-tight text-ink text-balance">
          This page wandered off.
        </h1>
        <p className="mx-auto mt-5 max-w-[44ch] text-lede text-graphite text-pretty">
          We looked everywhere — under the desk, behind the server rack, inside
          the coffee machine. It&apos;s just not here.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Button href="/" size="lg">
            Back to safety
          </Button>
          <Link
            href="/teapot"
            className="text-[13.5px] font-medium text-bronze-deep underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            …or get lost somewhere fun →
          </Link>
        </div>
      </div>
    </main>
  );
}
