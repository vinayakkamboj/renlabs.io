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
  title: "Best Practices · Documentation",
  description:
    "How to get the most reliable results from Ren Code on real codebases.",
};

export default function BestPracticesPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Develop"
        title="Best practices"
        intro="Ren Code does its best work when it understands what you want and can verify the result. A few habits make every change more reliable."
      />

      <DocH2>Describe intent, not keystrokes</DocH2>
      <DocP>
        Tell Ren Code the outcome you want and the constraints that matter —
        the behavior to preserve, the edge cases to handle, the parts of the
        system to avoid. Astra reasons about the change from there, rather than
        being walked through it line by line.
      </DocP>

      <DocH2>Let it analyze before it acts</DocH2>
      <DocP>
        On an existing repository, give Astra the chance to understand the
        codebase first. The more it knows about your architecture and
        conventions, the better its changes fit.
      </DocP>

      <DocH2>Keep changes reviewable</DocH2>
      <DocList
        items={[
          <>
            Prefer focused requests that map to a single pull request over
            sprawling, multi-feature asks.
          </>,
          <>
            Keep your tests and checks in place — they are how both you and
            Astra confirm a change is safe.
          </>,
          <>
            Read every diff. Review is the safeguard, and Ren Code is designed
            around it.
          </>,
        ]}
      />

      <DocH2>Scope access deliberately</DocH2>
      <DocP>
        Grant repository access per repo, and only where you want Ren Code
        working. Narrow scope keeps the model focused and keeps you in control
        of what it can see.
      </DocP>

      <DocCallout label="When in doubt">
        If a result looks confident but you are unsure, treat the uncertainty as
        a signal. Ask Ren Code to explain its reasoning or narrow the change —
        an admitted uncertainty is more useful than a confident wrong answer.
      </DocCallout>

      <DocPager href="/docs/best-practices" />
    </article>
  );
}
