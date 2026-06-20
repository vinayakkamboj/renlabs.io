import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Gauge } from "lucide-react";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const meteredFeatures = [
  "Pay only for what you call — no seats, no minimums.",
  "Usage is metered per request and billed monthly.",
  "Separate from Ren Code build credits — the API has its own meter.",
  "Set spend limits and alerts per key (coming with GA).",
];

export default function ConsoleBillingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          API billing
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          The Ren API is billed on usage, independent of your Ren Code build
          credits.
        </p>
      </div>

      {/* Preview notice */}
      <div className="rounded-xl border border-carbon-line bg-carbon-raised px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-dusk-muted">
          <span className="font-medium text-brass">Preview.</span> Metering and
          payment for the API are being finalized ahead of general availability.
          Nothing is charged today.
        </p>
      </div>

      {/* Usage meter placeholder */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-carbon-line bg-carbon-raised px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-xl border border-carbon-line bg-carbon">
          <Gauge className="size-[18px] text-brass" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-dusk">
            <span className="font-mono tnum text-brass">0</span> requests this month
          </p>
          <p className="text-[11.5px] text-dusk-faint">
            Usage will appear here once the live endpoint is enabled.
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/console"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3.5 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
          >
            Manage keys
          </Link>
        </div>
      </div>

      {/* How API billing works */}
      <section>
        <h2 className="mb-1 font-serif text-[1.2rem] text-dusk">
          How API billing works
        </h2>
        <p className="mb-5 text-[13px] text-dusk-muted">
          A usage-based model designed for production workloads.
        </p>
        <ul className="space-y-2.5">
          {meteredFeatures.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 rounded-xl border border-carbon-line bg-carbon-raised px-4 py-3 text-[13px] text-dusk-muted"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-brass" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-carbon-line bg-carbon-raised px-5 py-4">
        <p className="text-[13px] text-dusk-muted">
          Want early access to the metered API?
        </p>
        <a
          href="mailto:api@ren.ai"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep"
        >
          Request access
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
