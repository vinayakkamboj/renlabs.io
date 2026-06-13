import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";
import { astra } from "@/lib/data/astra";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Astra — Research",
  description:
    "Astra is Ren AI's flagship language model for reasoning, software engineering, long-context understanding, and agentic workflows.",
};

const versionDot: Record<string, string> = {
  current: "bg-bronze",
  planned: "bg-bronze-soft",
  research: "bg-stone",
};

export default function ResearchPage() {
  return (
    <>
      <PageIntro
        eyebrow="Ren AI · Flagship model"
        title={
          <>
            <em className="text-bronze-deep">Astra</em>
          </>
        }
        lede={astra.summary}
      >
        <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.14em] text-graphite-soft">
          {astra.kind} · {astra.status}
        </p>
      </PageIntro>

      <Container className="py-20 md:py-28">
        {/* Positioning */}
        <Reveal className="max-w-[68ch]">
          {astra.positioning.map((p) => (
            <p
              key={p}
              className="mb-5 text-lede text-graphite text-pretty last:mb-0"
            >
              {p}
            </p>
          ))}
        </Reveal>

        {/* Version roadmap */}
        <section className="mt-24">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink">Model roadmap</h2>
            <p className="mt-5 max-w-[54ch] text-lede text-graphite">
              A realistic path forward. We name the generations; we do not
              invent dates or results before they exist.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {astra.versions.map((v, i) => (
              <Reveal key={v.label} delay={Math.min(i * 0.06, 0.18)} className="bg-paper p-8">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-headline text-ink">{v.label}</span>
                  <span className={cn("size-2.5 rounded-full", versionDot[v.state])} />
                </div>
                <p className="mt-4 text-[12.5px] font-medium uppercase tracking-[0.1em] text-bronze-deep">
                  {v.phase}
                </p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-graphite text-pretty">
                  {v.detail}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The Journey of Astra */}
        <section className="mt-24">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink text-balance">
              The Journey of Astra
            </h2>
            <p className="mt-6 max-w-[68ch] text-lede text-graphite text-pretty">
              {astra.journey.intro}
            </p>
            <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-graphite text-pretty">
              {astra.journey.goal}
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
              Astra continues to evolve through
            </p>
            <ol className="mt-6">
              {astra.journey.loop.map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[3rem_1fr] items-baseline gap-4 border-t border-line py-5 md:grid-cols-[3rem_18rem_1fr]"
                >
                  <span className="font-mono text-[12px] text-graphite-soft">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-serif text-title text-ink">{step.title}</h3>
                  <p className="col-span-2 max-w-[58ch] text-[14px] leading-relaxed text-graphite md:col-span-1">
                    {step.detail}
                  </p>
                </li>
              ))}
              <li className="border-t border-line" />
            </ol>
          </Reveal>
        </section>

        {/* Current research focus */}
        <section className="mt-24">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink">Current research focus</h2>
            <p className="mt-5 max-w-[56ch] text-lede text-graphite">
              These are research areas of Astra — directions of the model, not
              separate products.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {astra.researchFocus.map((f, i) => (
              <Reveal key={f.title} delay={Math.min((i % 3) * 0.06, 0.18)} className="bg-paper p-7">
                <h3 className="font-serif text-title text-ink">{f.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-graphite text-pretty">
                  {f.detail}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 rounded-2xl border border-line bg-paper-deep/50 p-7">
            <p className="max-w-[70ch] text-[14px] leading-relaxed text-graphite">
              We will not publish benchmark numbers before we publish the
              evaluation harness that produces them. When capability results
              arrive, they will arrive with the method to reproduce them.
            </p>
          </Reveal>
        </section>

        <Reveal className="mt-20 flex flex-wrap gap-4">
          <Button href="/code" size="lg">
            See Ren Code
          </Button>
          <Button href="/docs" variant="outline" size="lg">
            Documentation
          </Button>
        </Reveal>
      </Container>
    </>
  );
}
