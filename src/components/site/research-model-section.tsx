import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { astra } from "@/lib/data/astra";
import { cn } from "@/lib/utils";

const versionDot: Record<string, string> = {
  current: "bg-bronze",
  planned: "bg-bronze-soft",
  research: "bg-stone",
};

export function ResearchModelSection() {
  return (
    <section className="border-t border-line bg-ink py-28 text-paper md:py-40" id="astra">
      <Container>
        {/* Header — Astra as the flagship model */}
        <Reveal className="max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze-soft">
            Ren AI · Flagship model
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2">
            <h2 className="font-serif text-display-xl font-normal leading-none text-paper">
              Astra
            </h2>
            <span className="pb-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-bronze-soft">
              {astra.kind}
            </span>
          </div>
          <p className="mt-8 max-w-[60ch] text-lede text-paper/70 text-pretty">
            {astra.positioning[0]}
          </p>
          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-paper/55 text-pretty">
            {astra.positioning[1]}
          </p>
        </Reveal>

        {/* Version roadmap */}
        <Reveal delay={0.1} className="mt-16">
          <p className="font-mono text-[10.5px] uppercase tracking-eyebrow text-paper/40">
            Model roadmap
          </p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-paper/12 bg-paper/12 md:grid-cols-3">
            {astra.versions.map((v) => (
              <div key={v.label} className="bg-ink p-7">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-headline text-paper">{v.label}</span>
                  <span className={cn("size-2 rounded-full", versionDot[v.state])} />
                </div>
                <p className="mt-3 text-[13px] font-medium uppercase tracking-[0.08em] text-bronze-soft">
                  {v.phase}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-paper/55">{v.detail}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Research focus */}
        <Reveal delay={0.1} className="mt-16">
          <p className="font-mono text-[10.5px] uppercase tracking-eyebrow text-paper/40">
            Research focus
          </p>
          <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {astra.researchFocus.map((f) => (
              <div key={f.title} className="border-t border-paper/12 pt-5">
                <h3 className="font-serif text-title text-paper">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-paper/55">{f.detail}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Tie back to Ren Code — the product powered by Astra */}
        <Reveal delay={0.15} className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-paper/12 pt-10 sm:flex-row sm:items-center">
          <p className="max-w-[44ch] font-serif text-title text-paper/85">
            Ren Code is the first product powered by Astra.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/research"
              className="group inline-flex items-center gap-2 text-sm font-medium text-bronze-soft transition-colors hover:text-paper"
            >
              Explore the research
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/code"
              className="group inline-flex items-center gap-2 text-sm font-medium text-paper/70 transition-colors hover:text-paper"
            >
              See Ren Code
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
