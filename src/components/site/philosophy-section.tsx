import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";

export const principles = [
  {
    n: "I",
    title: "Evidence over hype",
    body: "We are early, and we say so. We will not publish benchmark numbers before we publish the harness that produced them. If we cannot measure a claim, we do not make it.",
  },
  {
    n: "II",
    title: "Understanding over autocomplete",
    body: "Ren Code is built to understand a codebase — its architecture, dependencies, and conventions — before it changes anything. Correctness comes from context, not from guessing the next token.",
  },
  {
    n: "III",
    title: "Reliability over marketing",
    body: "A confident wrong change is worse than an admitted uncertainty. We design for review: pull requests you can read, reasoning you can inspect, and control over what merges.",
  },
  {
    n: "IV",
    title: "Honest about the stage",
    body: "Ren AI is in active development, building a single software engineering intelligence system. We would rather show real progress than stage a finished story. The roadmap is the product right now.",
  },
];

export function PhilosophySection() {
  return (
    <section className="border-t border-line bg-ink py-28 text-paper md:py-40" id="philosophy">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow className="text-bronze-soft">How we work</Eyebrow>
          <h2 className="mt-5 font-serif text-display font-normal text-paper text-balance">
            A calm, research-oriented way to build{" "}
            <em className="text-bronze-soft">software engineering AI</em>.
          </h2>
        </Reveal>

        <div className="mt-20">
          {principles.map((p, i) => (
            <Reveal
              key={p.n}
              delay={i * 0.05}
              className="grid gap-4 border-t border-paper/12 py-10 md:grid-cols-[6rem_minmax(0,18rem)_1fr] md:gap-10"
            >
              <span className="font-serif text-headline italic text-bronze-soft">{p.n}</span>
              <h3 className="font-serif text-title text-paper">{p.title}</h3>
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-paper/65 text-pretty">
                {p.body}
              </p>
            </Reveal>
          ))}
          <div className="border-t border-paper/12" />
        </div>
      </Container>
    </section>
  );
}
