import { ArrowRight, Layers, Cpu } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { newProjectExamples } from "@/lib/data/code";

export function WorkflowsSection() {
  return (
    <section className="border-t border-line bg-paper py-28 md:py-36" id="platform">
      <Container>
        <SectionHeading
          eyebrow="The platform"
          title={
            <>
              One platform. <em className="text-bronze-deep">Every stage of the build.</em>
            </>
          }
          lede="From the first line of code to production — Ren Labs handles the engineering so your team focuses on the product."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-2">
          {/* Ren Code */}
          <Reveal className="flex flex-col bg-paper p-8 md:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper-raised">
              <Layers className="size-5 text-bronze" strokeWidth={1.6} />
            </div>
            <h3 className="mt-6 font-serif text-headline text-ink">Ren Code</h3>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-graphite text-pretty">
              A full software engineering workspace. Describe what you need —
              new features, refactors, entire products — and Ren Code ships
              reviewable code your team owns.
            </p>
            <ul className="mt-7 space-y-2.5">
              {newProjectExamples.map((ex) => (
                <li
                  key={ex.prompt}
                  className="group flex items-baseline gap-3 border-t border-line pt-2.5"
                >
                  <span className="font-mono text-[12px] text-bronze">›</span>
                  <span className="text-[14.5px] font-medium text-ink">{ex.prompt}</span>
                  <span className="hidden text-[13px] text-graphite-soft sm:inline">— {ex.detail}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="group mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium text-ink transition-colors hover:text-bronze-deep"
            >
              Open workspace
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>

          {/* Astra API */}
          <Reveal delay={0.08} className="flex flex-col bg-paper p-8 md:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper-raised">
              <Cpu className="size-5 text-bronze" strokeWidth={1.6} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <h3 className="font-serif text-headline text-ink">Astra API</h3>
              <span className="rounded-full bg-bronze-wash px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bronze-deep">
                For your product
              </span>
            </div>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-graphite text-pretty">
              Integrate Astra directly into your own applications. The same model
              powering Ren Code — exposed as a simple REST API with OpenAI-compatible
              streaming, tool use, and low latency.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                "OpenAI-compatible",
                "Streaming responses",
                "Function calling",
                "Low latency",
                "Usage analytics",
                "Per-key billing",
                "Role-based access",
                "SLA guarantees",
              ].map((c) => (
                <span key={c} className="border-t border-line pt-2.5 text-[13.5px] text-ink-soft">
                  {c}
                </span>
              ))}
            </div>
            <Link
              href="/docs/api-reference"
              className="group mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium text-ink transition-colors hover:text-bronze-deep"
            >
              API reference
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
