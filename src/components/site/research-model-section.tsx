import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { astra } from "@/lib/data/astra";
import { cn } from "@/lib/utils";

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

export function ResearchModelSection() {
  return (
    <section className="border-t border-line bg-paper py-28 md:py-36" id="astra">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-end">
          <SectionHeading
            eyebrow="The model"
            title={
              <>
                Powered by <em className="text-bronze-deep">Astra</em>.
              </>
            }
            lede={astra.summary}
          />
          <Reveal delay={0.1} className="space-y-5 lg:pb-2">
            {astra.description.map((p) => (
              <p key={p} className="max-w-[44ch] text-[15px] leading-relaxed text-graphite text-pretty">
                {p}
              </p>
            ))}
          </Reveal>
        </div>

        {/* Focus areas */}
        <Reveal delay={0.1} className="mt-16">
          <h3 className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
            Focus areas
          </h3>
          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {astra.focusAreas.map((f) => (
              <div key={f.title} className="bg-paper p-6">
                <h4 className="font-serif text-[1.05rem] text-ink">{f.title}</h4>
                <p className="mt-2.5 text-[13px] leading-relaxed text-graphite">{f.detail}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center gap-2 bg-paper-deep/50 p-6">
              <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-bronze-deep">
                <span className="size-1.5 animate-pulse rounded-full bg-bronze" />
                {astra.status}
              </span>
              <p className="text-[12.5px] leading-relaxed text-graphite-soft">
                An intelligence system, not a snippet generator.
              </p>
            </div>
          </div>
        </Reveal>

        {/* How Astra develops — honest, qualitative */}
        <Reveal delay={0.15} className="mt-16">
          <h3 className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
            How Astra evolves
          </h3>
          <ol className="mt-6 space-y-1">
            {astra.phases.map((p) => (
              <li
                key={p.label}
                className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-line py-4 md:grid-cols-[16rem_1fr_7rem]"
              >
                <span className="flex items-center gap-3 text-[15px] font-medium text-ink">
                  <span className={cn("size-1.5 rounded-full", stateDot[p.state])} />
                  {p.label}
                </span>
                <span className="col-span-2 max-w-[60ch] text-[13.5px] leading-relaxed text-graphite md:col-span-1">
                  {p.detail}
                </span>
                <span className="hidden text-right font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft md:block">
                  {stateLabel[p.state]}
                </span>
              </li>
            ))}
            <li className="border-t border-line" />
          </ol>
        </Reveal>

        {/* Mission */}
        <Reveal delay={0.15} className="mt-16 max-w-[64ch]">
          <p className="font-serif text-headline font-normal text-ink text-balance">
            {astra.mission[0]}
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-graphite text-pretty">
            {astra.mission[1]}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
