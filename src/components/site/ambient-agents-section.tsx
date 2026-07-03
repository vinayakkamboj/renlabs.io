import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { GitBranch, RadioTower, Timer } from "lucide-react";

/**
 * The bold, plain-language pitch for ambient agents — Ren's core
 * differentiator. Most AI coding tools are "human-in-the-loop": you prompt,
 * it responds, it stops. Ren's agents are "ambient" (a.k.a. human-ON-the-loop
 * — you supervise, you don't drive): once you turn one on, it keeps working
 * on a schedule, on its own branch, whether or not you're watching.
 */
const PILLARS = [
  {
    icon: RadioTower,
    title: "Runs without you",
    detail:
      "Turn an agent's loop on and it keeps working on a schedule — testing, improving, shipping — even after you close the tab or shut your laptop.",
  },
  {
    icon: GitBranch,
    title: "Never touches your live app",
    detail:
      "Every ambient edit lands on a separate ren branch. Your production app stays untouched until you review the diff and promote it yourself.",
  },
  {
    icon: Timer,
    title: "You set the pace",
    detail:
      "A burn-rate cap — tokens per minute — throttles how fast an agent is allowed to work. Slow and cheap, or fast and thorough. Your call, per agent.",
  },
];

export function AmbientAgentsSection() {
  return (
    <section className="border-t border-line bg-ink py-28 md:py-36">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze-soft">
            What makes Ren different
          </p>
          <h2 className="mt-5 font-serif text-display font-normal text-paper text-balance">
            Not a chatbot you prompt.
            <br />
            An agent that keeps working.
          </h2>
          <p className="mx-auto mt-6 max-w-[52ch] text-lede text-paper/70">
            Most AI tools are <span className="text-paper">human-in-the-loop</span>:
            you ask, it answers, it stops. Ren&apos;s agents are{" "}
            <span className="text-paper">ambient</span> — turn one on and it
            runs continuously in the background, on its own review branch,
            until you tell it to stop.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {PILLARS.map((p) => (
            <Reveal key={p.title} className="bg-ink p-8 md:p-10">
              <p.icon className="size-5 text-bronze-soft" strokeWidth={1.6} />
              <p className="mt-5 text-[15px] font-medium text-paper">{p.title}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper/60">
                {p.detail}
              </p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
