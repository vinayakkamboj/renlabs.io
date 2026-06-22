import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CREDIT_PACKS,
  packPriceUSD,
  buildsInPack,
  formatCredits,
} from "@/lib/credits/config";

export const metadata: Metadata = {
  title: "Pricing · Ren Labs",
  description:
    "Simple, credit-based pricing for Ren Code. Pay for what you build — four plans from Starter to Studio. Your first build is free.",
};

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Full access to Astra v1",
    "Live preview & instant deploys",
    "Image-to-app from screenshots",
    "Credits never expire",
  ],
  growth: [
    "Everything in Starter",
    "10% bonus credits",
    "Private projects",
    "GitHub import & export",
  ],
  pro: [
    "Everything in Growth",
    "15% bonus credits",
    "Priority build queue",
    "Email support",
  ],
  studio: [
    "Everything in Pro",
    "20% bonus credits",
    "Team workspace",
    "Priority support",
  ],
};

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-28 pt-32 md:px-10">
      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-bronze-deep">
          Pricing
        </p>
        <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.05] tracking-tight text-ink md:text-[3.2rem]">
          Pay for what you build
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-graphite">
          Ren Code runs on credits — buy a pack, spend it as you build. No
          subscriptions, no seats, and credits never expire. Every new account
          gets its <span className="text-ink">first build free</span>.
        </p>
      </div>

      {/* Plans */}
      <div className="mt-16 grid gap-5 lg:grid-cols-4">
        {CREDIT_PACKS.map((pack) => {
          const builds = buildsInPack(pack, "v1");
          const featured = pack.featured;
          return (
            <div
              key={pack.id}
              className={[
                "relative flex flex-col rounded-2xl border p-6",
                featured
                  ? "border-bronze/40 bg-paper-raised shadow-lift"
                  : "border-line bg-paper",
              ].join(" ")}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-bronze px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper">
                  Most popular
                </span>
              )}

              <h2 className="font-serif text-[1.35rem] tracking-tight text-ink">
                {pack.name}
              </h2>
              <p className="mt-1.5 min-h-[2.5rem] text-[13px] leading-relaxed text-graphite-soft">
                {pack.description}
              </p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-serif text-[2.4rem] leading-none tracking-tight text-ink tnum">
                  {packPriceUSD(pack)}
                </span>
                <span className="text-[12.5px] text-graphite-soft">one-time</span>
              </div>

              <div className="mt-3 space-y-0.5 text-[13px]">
                <p className="text-ink">
                  <span className="font-medium tnum">{formatCredits(pack.credits)}</span>{" "}
                  credits
                </p>
                <p className="text-graphite-soft">
                  ≈ <span className="tnum">{builds.toLocaleString()}</span> Astra builds
                  {pack.bonusCredits > 0 && (
                    <span className="text-bronze-deep">
                      {" "}
                      · +{formatCredits(pack.bonusCredits)} bonus
                    </span>
                  )}
                </p>
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {PLAN_FEATURES[pack.id]?.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-graphite">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-bronze-deep" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                href="/dashboard"
                variant={featured ? "bronze" : "outline"}
                size="md"
                className="mt-6 w-full"
              >
                Get {pack.name}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-line bg-paper-deep/40 p-6 text-center">
        <p className="text-[13.5px] leading-relaxed text-graphite">
          A credit is <span className="text-ink">$0.01</span>. A typical Astra
          build costs <span className="text-ink">40 credits</span> — the exact
          spend scales with the size of the change. You only pay when a build
          succeeds; failed builds are never charged.
        </p>
        <p className="mt-3 text-[13px] text-graphite-soft">
          Need a custom volume or an enterprise agreement?{" "}
          <a
            href="mailto:founders@renlabs.io"
            className="text-bronze-deep underline-offset-2 hover:underline"
          >
            Talk to us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
