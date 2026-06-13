import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/site/page-intro";

export const metadata: Metadata = {
  title: "Ren API",
  description:
    "Integrate Astra into your engineering workflows. An OpenAI-compatible API for repository understanding, code generation, and agent workflows.",
};

const capabilities = [
  {
    title: "Repository Understanding",
    detail: "Reason over a connected codebase — architecture, dependencies, and conventions.",
  },
  {
    title: "Code Generation",
    detail: "Produce changes consistent with the patterns already in the repository.",
  },
  {
    title: "Architecture Analysis",
    detail: "Map how a system fits together and what a change will touch.",
  },
  {
    title: "Pull Request Creation",
    detail: "Open reviewable pull requests as a programmatic operation.",
  },
  {
    title: "Agent Workflows",
    detail: "Plan, run, and verify multi-step changes end to end.",
  },
  {
    title: "Software Engineering Automation",
    detail: "Drive Ren Code from your own systems, metered per request.",
  },
];

const snippet = `curl https://api.ren.ai/v1/chat/completions \\
  -H "Authorization: Bearer $REN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "astra",
    "messages": [
      {
        "role": "user",
        "content": "Add cursor pagination to the activity feed and open a PR."
      }
    ],
    "stream": true
  }'`;

export default function ApiPage() {
  return (
    <>
      <PageIntro
        eyebrow="Developer platform"
        title={
          <>
            Ren <em className="text-bronze-deep">API</em>.
          </>
        }
        lede="Integrate Astra into your engineering workflows. Astra is served behind a stable, OpenAI-compatible endpoint, so the tools you already use work with a base URL and a model id."
      >
        <div className="mt-10 flex flex-wrap gap-4">
          <Button href="/docs/api-reference" size="lg">
            API reference
          </Button>
          <Button href="/login" variant="outline" size="lg">
            Request access
          </Button>
        </div>
      </PageIntro>

      {/* Example */}
      <section className="border-b border-line">
        <Container className="py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,34rem)]">
            <Reveal>
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
                One endpoint
              </span>
              <h2 className="mt-5 max-w-[18ch] font-serif text-display font-normal text-ink text-balance">
                Familiar by design.
              </h2>
              <p className="mt-6 max-w-[48ch] text-lede text-graphite text-pretty">
                Point an OpenAI-compatible client at the Ren base URL, set the
                model to <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[0.85em] text-ink">astra</code>, and
                start sending engineering tasks. No new SDK to learn.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="overflow-hidden rounded-2xl border border-carbon-line bg-carbon shadow-float">
                <div className="flex items-center justify-between border-b border-carbon-line px-4 py-2.5">
                  <span className="font-mono text-[11px] text-dusk-muted">request.sh</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal-green">
                    ● astra
                  </span>
                </div>
                <pre className="platform-scroll overflow-x-auto px-4 py-4">
                  <code className="font-mono text-[12px] leading-relaxed text-dusk">{snippet}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <section className="bg-paper-deep/40">
        <Container className="py-20 md:py-28">
          <Reveal>
            <span className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
              On the roadmap
            </span>
            <h2 className="mt-5 max-w-[20ch] font-serif text-display font-normal text-ink text-balance">
              What the API will do.
            </h2>
            <p className="mt-6 max-w-[56ch] text-lede text-graphite text-pretty">
              The platform is in active development. These are the capabilities
              we are building toward — exposed as you would expect from a
              serious developer platform.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <Reveal key={c.title} className="bg-paper p-7">
                <h3 className="font-serif text-title text-ink">{c.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-graphite text-pretty">
                  {c.detail}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-paper">
        <Container className="py-24 md:py-32">
          <Reveal className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="max-w-[24ch] font-serif text-headline text-ink text-balance">
                Build with Astra.
              </h2>
              <p className="mt-3 max-w-[48ch] text-[15px] text-graphite">
                Read the reference, or request access to the developer preview.
              </p>
            </div>
            <Button href="/docs/api-reference" size="lg">
              Read the reference
              <ArrowRight className="size-4" />
            </Button>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
