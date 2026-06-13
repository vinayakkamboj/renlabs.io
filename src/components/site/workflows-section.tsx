import Link from "next/link";
import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { newProjectExamples } from "@/lib/data/code";

export function WorkflowsSection() {
  return (
    <section className="border-t border-line bg-paper py-28 md:py-36" id="workflows">
      <Container>
        <SectionHeading
          eyebrow="How Ren Code works"
          title={
            <>
              Two ways in. <em className="text-bronze-deep">One engineer.</em>
            </>
          }
          lede="Whether you are starting from nothing or working inside a codebase with years of history, Ren Code meets you where the work is."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-2">
          {/* New project */}
          <Reveal className="flex flex-col bg-paper p-8 md:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper-raised">
              <Sparkles className="size-5 text-bronze" strokeWidth={1.6} />
            </div>
            <h3 className="mt-6 font-serif text-headline text-ink">New project</h3>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-graphite text-pretty">
              Start a new application from a prompt. Describe the product and
              Ren Code scaffolds a real, coherent codebase you can keep building on.
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
              Start a new project
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>

          {/* Existing repository */}
          <Reveal delay={0.08} className="flex flex-col bg-paper p-8 md:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper-raised">
              <GitBranch className="size-5 text-bronze" strokeWidth={1.6} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <h3 className="font-serif text-headline text-ink">Existing repository</h3>
              <span className="rounded-full bg-bronze-wash px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-bronze-deep">
                The differentiator
              </span>
            </div>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-graphite text-pretty">
              Connect a GitHub repository and Ren Code learns it first —
              architecture, dependencies, conventions — then generates features,
              refactors, tests, and pull requests that fit.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                "Understand architecture",
                "Analyze dependencies",
                "Generate features",
                "Refactor safely",
                "Create pull requests",
                "Write tests",
                "Generate docs",
                "Explain the codebase",
              ].map((c) => (
                <span key={c} className="border-t border-line pt-2.5 text-[13.5px] text-ink-soft">
                  {c}
                </span>
              ))}
            </div>
            <Link
              href="/code#repository"
              className="group mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium text-ink transition-colors hover:text-bronze-deep"
            >
              See the repository workflow
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
