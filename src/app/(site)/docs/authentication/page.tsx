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
  title: "Authentication · Documentation",
  description:
    "Sign in with email or Google, and how sessions and protected workspaces work.",
};

export default function AuthenticationPage() {
  return (
    <article>
      <DocHeader
        eyebrow="Get started"
        title="Authentication"
        intro="Ren Code uses Supabase for authentication. You can sign in with email or with Google, and your workspace is protected behind that session."
      />

      <DocH2>Ways to sign in</DocH2>
      <DocList
        items={[
          <>
            <strong className="font-medium text-ink">Email and password.</strong>{" "}
            Create an account with an email address and a password of at least
            eight characters.
          </>,
          <>
            <strong className="font-medium text-ink">Magic link.</strong> Enter
            your email and we send a one-time sign-in link — no password to
            remember.
          </>,
          <>
            <strong className="font-medium text-ink">Google.</strong> Continue
            with your Google account using OAuth.
          </>,
        ]}
      />

      <DocH2>Sessions</DocH2>
      <DocP>
        After you sign in, your session is stored in secure cookies and
        refreshed automatically as you use the workspace, so you stay signed in
        across visits until you sign out.
      </DocP>

      <DocH2>Protected workspaces</DocH2>
      <DocP>
        Your workspace — projects, repositories, conversations, and pull
        requests — lives behind authentication. Choosing{" "}
        <strong className="font-medium text-ink">Start building</strong> while
        signed out takes you to the sign-in page first, then returns you to
        where you were headed.
      </DocP>

      <DocCallout label="Your data">
        Every record is scoped to your account with row-level security: you can
        only ever read and write your own projects, repositories, and
        conversations.
      </DocCallout>

      <DocPager href="/docs/authentication" />
    </article>
  );
}
