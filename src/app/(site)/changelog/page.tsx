import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { PageIntro } from "@/components/site/page-intro";

export const metadata: Metadata = {
  title: "Changelog — Ren AI",
  description: "What's new in Ren Code and the Astra model.",
};

const entries = [
  {
    date: "June 2026",
    version: "0.1.0",
    title: "Initial platform launch",
    items: [
      "Ren Code workspace — projects, repositories, pull requests, conversations.",
      "Google and GitHub OAuth authentication via Supabase.",
      "Documentation site with getting started, API reference, and best practices.",
      "Ren API platform page and the Astra HTTPS endpoint design.",
      "Astra model in active development — focus areas published.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageIntro
        eyebrow="Changelog"
        title="What's new."
        lede="A record of meaningful changes to Ren Code, Astra, and the platform — published as they ship."
      />

      <Container className="py-20 md:py-28">
        <div className="max-w-2xl">
          {entries.map((entry, i) => (
            <Reveal key={entry.version} delay={i * 0.05} className="border-t border-line py-10">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[11px] uppercase tracking-eyebrow text-bronze">
                  {entry.date}
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10.5px] text-graphite-soft">
                  v{entry.version}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-headline text-ink">{entry.title}</h2>
              <ul className="mt-5 space-y-2.5">
                {entry.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[14.5px] leading-relaxed text-graphite">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-bronze" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
          <div className="rule" />
        </div>
      </Container>
    </>
  );
}
