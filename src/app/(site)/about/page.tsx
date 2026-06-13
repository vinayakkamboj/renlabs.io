import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";

export const metadata: Metadata = {
  title: "About — Ren AI",
  description:
    "Ren AI is an AI research company building Astra, its flagship language model, and Ren Code, the first product powered by it.",
};

const values = [
  {
    n: "I",
    title: "Intelligence through reasoning",
    body: "We build systems that understand software, not systems that guess at it. Astra is designed to read a codebase as a whole and reason about changes the way an engineer would.",
  },
  {
    n: "II",
    title: "Honest about the stage",
    body: "Ren AI is in active development. We publish progress as it is, not as we wish it were. The roadmap is real, the work is ongoing, and we say so.",
  },
  {
    n: "III",
    title: "Review, not automation",
    body: "Every change Ren Code produces is a pull request you read. We build for human review, not blind automation. Your judgment is part of the design.",
  },
  {
    n: "IV",
    title: "Compounding from day one",
    body: "We are building Ren AI to grow: own model, own evaluation, own data discipline — installed from the start rather than retrofitted.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About Ren AI"
        title={
          <>
            Building software engineering{" "}
            <em className="text-bronze-deep">intelligence</em>.
          </>
        }
        lede="Ren AI is the company. Astra is the model. Ren Code is the product. We are building AI that understands software systems as a whole — and improving it in the open."
      />

      <Container className="py-20 md:py-28">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          <Reveal>
            <h2 className="font-serif text-display font-normal text-ink text-balance">
              What we are building.
            </h2>
            <p className="mt-6 text-lede text-graphite text-pretty">
              Ren AI is an AI research company. Our core work is Astra — our
              flagship language model, built for reasoning, software
              engineering, long-context understanding, and agentic workflows.
              Astra is the intelligence layer powering every Ren AI product.
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-graphite text-pretty">
              Ren Code is the first product powered by Astra: AI software
              engineering that reads your codebase before it changes a line of
              it. You describe a change. Ren Code produces a pull request you
              review. You stay in control of what merges.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="font-serif text-display font-normal text-ink text-balance">
              How we work.
            </h2>
            <p className="mt-6 text-lede text-graphite text-pretty">
              We publish progress honestly. Capability numbers arrive only with
              the evaluation harness that produces them. Negative results enter
              the record. The roadmap is real.
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-graphite text-pretty">
              The goal is a research organization that compounds: own data, own
              adapters, own evaluation, own pretraining — built with the
              discipline installed from day one.
            </p>
          </Reveal>
        </div>

        {/* Values */}
        <div className="mt-24">
          {values.map((v, i) => (
            <Reveal
              key={v.n}
              delay={Math.min(i * 0.05, 0.2)}
              className="grid gap-4 border-t border-line py-10 md:grid-cols-[5rem_minmax(0,18rem)_1fr] md:gap-10"
            >
              <span className="font-serif text-headline italic text-bronze">{v.n}</span>
              <h3 className="font-serif text-title text-ink">{v.title}</h3>
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-graphite text-pretty">
                {v.body}
              </p>
            </Reveal>
          ))}
          <div className="rule" />
        </div>

        <Reveal className="mt-20">
          <Button href="/code" size="lg">
            See Ren Code
          </Button>
        </Reveal>
      </Container>
    </>
  );
}
