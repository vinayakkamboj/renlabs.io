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
  title: "GitHub Integration · Documentation",
  description:
    "Connect repositories through GitHub, with explicit, revocable, per-repo access.",
};

export default function GithubIntegrationPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Workflows"
        title="GitHub integration"
        intro="Connect a repository through GitHub and Ren Code can read it, understand it, and open pull requests against it — with you deciding exactly what it can see."
      />

      <DocH2>The connection flow</DocH2>
      <DocList
        ordered
        items={[
          <>
            <strong className="font-medium text-ink">Authorize with GitHub.</strong>{" "}
            Connect through GitHub OAuth. Scopes are explicit and revocable at
            any time from your GitHub settings.
          </>,
          <>
            <strong className="font-medium text-ink">Select repositories.</strong>{" "}
            Choose exactly which repositories Ren Code can access. Access is
            granted per repository, never blanket.
          </>,
          <>
            <strong className="font-medium text-ink">Index and analyze.</strong>{" "}
            Astra builds an understanding of structure, dependencies, and
            conventions before any change is proposed.
          </>,
          <>
            <strong className="font-medium text-ink">Generate pull requests.</strong>{" "}
            Describe a change and review a real pull request. You stay in
            control of what merges.
          </>,
        ]}
      />

      <DocH2>Access and control</DocH2>
      <DocP>
        Ren Code reads only the repositories you grant and nothing else. You can
        revoke access for any repository, or disconnect entirely, at any time —
        from inside the workspace or from GitHub directly.
      </DocP>

      <DocH2>What Ren Code writes</DocH2>
      <DocP>
        Ren Code does not push directly to your default branch. Changes are
        delivered as pull requests on their own branches, so every change passes
        through review and your existing checks before it can merge.
      </DocP>

      <DocCallout label="Configuration">
        GitHub sign-in and repository connection activate once GitHub OAuth is
        configured for your deployment. Until then, the integration screens
        explain what is needed rather than failing silently.
      </DocCallout>

      <DocPager href="/docs/github-integration" />
    </article>
  );
}
