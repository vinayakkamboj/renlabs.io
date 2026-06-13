import type { Metadata } from "next";
import {
  DocHeader,
  DocH2,
  DocP,
  DocList,
  DocCallout,
  DocPager,
} from "@/components/docs/doc-kit";

export const metadata: Metadata = {
  title: "Repository Analysis · Documentation",
  description:
    "How Astra reads a codebase — architecture, dependencies, and conventions.",
};

export default function RepositoryAnalysisPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Workflows"
        title="Repository analysis"
        intro="Before Ren Code changes anything, Astra reads the repository as a connected system. Understanding comes from context, not from guessing the next token."
      />

      <DocH2>What Astra builds an understanding of</DocH2>
      <DocList
        items={[
          <>
            <strong className="font-medium text-ink">Architecture.</strong> How
            the system fits together — services, modules, boundaries, and the
            decisions behind them.
          </>,
          <>
            <strong className="font-medium text-ink">Dependencies.</strong>{" "}
            Internal and external dependencies, so the blast radius of a change
            is understood before it is made.
          </>,
          <>
            <strong className="font-medium text-ink">Conventions.</strong> The
            patterns and idioms the codebase already uses, so new code reads like
            it belongs.
          </>,
        ]}
      />

      <DocH2>Why it matters</DocH2>
      <DocP>
        A change is only correct in context. By understanding the whole
        repository first, Astra can make changes that are consistent with the
        existing design, touch the files they actually need to, and avoid the
        subtle breakage that comes from editing code in isolation.
      </DocP>

      <DocH2>Asking questions</DocH2>
      <DocP>
        Repository understanding is also useful on its own. You can ask how a
        part of the system works, why something is structured the way it is, or
        where a particular behavior lives — a fast way to onboard a new
        engineer, or yourself, into unfamiliar code.
      </DocP>

      <DocCallout label="Long context">
        Astra is designed to hold large codebases in context, so changes are
        reasoned about globally rather than one file at a time.
      </DocCallout>

      <DocPager href="/docs/repository-analysis" />
    </article>
  );
}
