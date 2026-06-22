import { Hero } from "@/components/site/hero";
import { WorkflowsSection } from "@/components/site/workflows-section";
import { ResearchModelSection } from "@/components/site/research-model-section";
import { PhilosophySection } from "@/components/site/philosophy-section";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";

function EnterpriseSection() {
  const signals = [
    { stat: "79.3%", label: "LiveCodeBench", sub: "ahead of Opus 4.8, GPT-5.4 & Gemini" },
    { stat: "2.7×", label: "lower blended cost", sub: "vs. Claude Opus 4.8" },
    { stat: "< 30s", label: "first generation", sub: "from prompt to running code" },
  ];

  return (
    <section className="border-t border-line bg-paper-deep/50 py-28 md:py-36">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
            Built for enterprise startups
          </p>
          <h2 className="mt-5 font-serif text-display font-normal text-ink text-balance">
            Frontier model performance. Startup-friendly economics.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {signals.map((s) => (
            <Reveal key={s.label} className="bg-paper p-8 text-center md:p-10">
              <p className="font-serif text-[3rem] font-normal leading-none text-bronze-deep">
                {s.stat}
              </p>
              <p className="mt-3 text-[15px] font-medium text-ink">{s.label}</p>
              <p className="mt-1.5 text-[13px] text-graphite">{s.sub}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ClosingSection() {
  return (
    <section className="border-t border-line bg-paper-deep/50 py-32 md:py-44">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
            Ren Labs
          </p>
          <h2 className="mt-6 font-serif text-display font-normal text-ink text-balance">
            Your AI engineering team, ready on day one.
          </h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-lede text-graphite">
            Enterprise startups move fast. Ren Labs makes sure your engineering
            keeps up — without scaling headcount to match.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button href="/dashboard" size="lg">
              Start building
            </Button>
            <Button href="/docs" variant="outline" size="lg">
              Read the docs
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <WorkflowsSection />
      <EnterpriseSection />
      <ResearchModelSection />
      <PhilosophySection />
      <ClosingSection />
    </>
  );
}
