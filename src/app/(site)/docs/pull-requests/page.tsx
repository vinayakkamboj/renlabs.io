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
  title: "Pull Requests · Documentation",
  description:
    "Describe a change, review a real pull request, and stay in control of what merges.",
};

export default function PullRequestsPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Workflows"
        title="Pull requests"
        intro="Ren Code delivers changes as pull requests, not silent commits. You read the diff, you decide what merges — autonomy with an audit trail."
      />

      <DocH2>From a request to a PR</DocH2>
      <DocList
        ordered
        items={[
          <>Describe the change you want in plain language.</>,
          <>
            Astra plans the work across the files it actually affects, drawing on
            its understanding of the repository.
          </>,
          <>
            Where it helps, it runs tests and verifies its own work before
            returning anything.
          </>,
          <>
            A pull request is opened on its own branch with a clear description
            of what changed and why.
          </>,
        ]}
      />

      <DocH2>What a good pull request includes</DocH2>
      <DocList
        items={[
          <>A summary of the change and the reasoning behind it.</>,
          <>A diff scoped to the files the change genuinely touches.</>,
          <>Tests that capture intended behavior, where appropriate.</>,
          <>Anything you should double-check before merging, stated plainly.</>,
        ]}
      />

      <DocH2>You stay in control</DocH2>
      <DocP>
        Nothing merges without your review. Pull requests run through your
        existing branch protections and checks, just like a change from anyone
        on your team. A confident wrong change is worse than an admitted
        uncertainty, so Ren Code is built for review rather than blind
        automation.
      </DocP>

      <DocCallout label="Reviewing well">
        Treat a Ren Code pull request like any other: read the diff, run the
        checks, and ask for changes if something is off. The review is the
        safeguard, and it is meant to be used.
      </DocCallout>

      <DocPager href="/docs/pull-requests" />
    </article>
  );
}
