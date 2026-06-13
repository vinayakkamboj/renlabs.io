import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";
import { astra } from "@/lib/data/astra";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Astra — Ren AI's software engineering intelligence system. Actively evolving, with progress published honestly.",
};

const stateLabel: Record<string, string> = {
  "in-progress": "In progress",
  next: "Next",
  planned: "Planned",
};
const stateDot: Record<string, string> = {
  "in-progress": "bg-bronze",
  next: "bg-bronze-soft",
  planned: "bg-stone",
};

export default function ResearchPage() {
  return (
    <>
      <PageIntro
        eyebrow="The model behind Ren Code"
        title={
          <>
            Powered by <em className="text-bronze-deep">Astra</em>.
          </>
        }
        lede={astra.summary}
      />

      <Container className="py-20 md:py-28">
        {/* Description */}
        <Reveal className="max-w-[68ch]">
          {astra.description.map((p) => (
            <p
              key={p}
              className="mb-5 text-lede text-graphite text-pretty last:mb-0"
            >
              {p}
            </p>
          ))}
        </Reveal>

        {/* Focus areas */}
        <section className="mt-20">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink">Focus areas</h2>
            <p className="mt-5 max-w-[54ch] text-lede text-graphite">
              Astra is purpose-built for software engineering — every capability
              points at understanding and improving entire software systems.
            </p>
          </Reveal>
          <div className="mt-12">
            {astra.focusAreas.map((f, i) => (
              <Reveal
                key={f.title}
                delay={Math.min(i * 0.04, 0.2)}
                className="grid gap-4 border-t border-line py-8 md:grid-cols-[22rem_1fr] md:gap-10"
              >
                <h3 className="font-serif text-title text-ink">{f.title}</h3>
                <p className="max-w-[60ch] text-[15px] leading-relaxed text-graphite text-pretty">
                  {f.detail}
                </p>
              </Reveal>
            ))}
            <div className="rule" />
          </div>
        </section>

        {/* How Astra evolves */}
        <section className="mt-20">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink">How Astra evolves</h2>
            <p className="mt-5 max-w-[54ch] text-lede text-graphite">
              A real, ongoing research effort — shown as it actually stands.
            </p>
          </Reveal>
          <ol className="mt-12">
            {astra.phases.map((p, i) => (
              <Reveal
                key={p.label}
                delay={Math.min(i * 0.05, 0.2)}
                className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-line py-6 md:grid-cols-[18rem_1fr_7rem]"
              >
                <span className="flex items-center gap-3 font-serif text-title text-ink">
                  <span className={cn("size-2 rounded-full", stateDot[p.state])} />
                  {p.label}
                </span>
                <span className="col-span-2 max-w-[60ch] text-[14.5px] leading-relaxed text-graphite md:col-span-1">
                  {p.detail}
                </span>
                <span className="hidden text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft md:block">
                  {stateLabel[p.state]}
                </span>
              </Reveal>
            ))}
            <li className="border-t border-line" />
          </ol>
          <Reveal className="mt-10 rounded-2xl border border-line bg-paper-deep/50 p-7">
            <p className="max-w-[70ch] text-[14px] leading-relaxed text-graphite">
              We will not publish benchmark numbers before we publish the
              evaluation harness that produces them. When capability results
              arrive, they will arrive with the method to reproduce them.
            </p>
          </Reveal>
        </section>

        {/* Mission */}
        <Reveal className="mt-20 max-w-[64ch]">
          <p className="font-serif text-headline font-normal text-ink text-balance">
            {astra.mission[0]}
          </p>
          <p className="mt-5 text-lede text-graphite text-pretty">
            {astra.mission[1]}
          </p>
        </Reveal>

        <Reveal className="mt-16">
          <Button href="/code" size="lg">
            See Ren Code
          </Button>
        </Reveal>
      </Container>
    </>
  );
}
