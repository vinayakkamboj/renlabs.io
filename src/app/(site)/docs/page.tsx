import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsFlat } from "@/lib/data/docs";
import {
  DocHeader,
  DocH2,
  DocP,
  DocList,
  DocCallout,
  DocPager,
} from "@/components/docs/doc-kit";

export const metadata: Metadata = {
  title: "Getting Started · Documentation",
  description:
    "What Ren Code is, and how to go from a repository to a reviewable pull request.",
};

export default function GettingStartedPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Documentation"
        title="Getting started with Ren Code"
        intro="Ren Code is AI software engineering, powered by Astra. It builds new applications from a prompt and continues development on existing repositories — understanding a codebase before it changes a line."
      />

      <DocH2>The core idea</DocH2>
      <DocP>
        Most code assistants generate isolated snippets. Ren Code is built
        around Astra, an intelligence system that reads a repository as a whole
        — its architecture, dependencies, and conventions — and reasons about
        changes the way an engineer on your team would. The output is a pull
        request you review, not a silent edit.
      </DocP>

      <DocH2>Two ways to work</DocH2>
      <DocList
        items={[
          <>
            <strong className="font-medium text-ink">Start a new project.</strong>{" "}
            Describe the application you want and Ren Code scaffolds a real,
            coherent codebase you keep building inside your workspace.
          </>,
          <>
            <strong className="font-medium text-ink">Continue an existing repository.</strong>{" "}
            Connect a GitHub repository and Ren Code learns it first, then
            generates features, refactors, tests, and pull requests that fit.
          </>,
        ]}
      />

      <DocH2>A typical first session</DocH2>
      <DocList
        ordered
        items={[
          <>
            <Link href="/docs/authentication" className="text-bronze-deep underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            and create your workspace.
          </>,
          <>
            <Link href="/docs/github-integration" className="text-bronze-deep underline-offset-4 hover:underline">
              Connect a repository
            </Link>{" "}
            through GitHub, granting access per repo.
          </>,
          <>
            Let Astra{" "}
            <Link href="/docs/repository-analysis" className="text-bronze-deep underline-offset-4 hover:underline">
              analyze the repository
            </Link>{" "}
            so it understands the structure before changing anything.
          </>,
          <>
            Describe a change and review the resulting{" "}
            <Link href="/docs/pull-requests" className="text-bronze-deep underline-offset-4 hover:underline">
              pull request
            </Link>
            . You decide what merges.
          </>,
        ]}
      />

      <DocCallout label="Honest about the stage">
        Ren AI is in active development. These docs describe how Ren Code works
        today and where it is heading — we describe progress as it actually is,
        not as we wish it were.
      </DocCallout>

      <DocH2>Keep reading</DocH2>
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        {docsFlat.slice(1).map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group bg-paper p-6 transition-colors hover:bg-paper-deep"
          >
            <span className="flex items-center justify-between font-serif text-title text-ink">
              {d.title}
              <ArrowRight className="size-4 text-graphite-soft transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-2 block text-[13.5px] leading-relaxed text-graphite">
              {d.summary}
            </span>
          </Link>
        ))}
      </div>

      <DocPager href="/docs" />
    </article>
  );
}
