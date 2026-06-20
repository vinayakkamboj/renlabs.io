import type { Metadata } from "next";
import Link from "next/link";
import {
  DocHeader,
  DocH2,
  DocP,
  DocList,
  DocCode,
  DocCallout,
  DocPager,
} from "@/components/docs/doc-kit";

export const metadata: Metadata = {
  title: "API Reference · Documentation",
  description: "The shape of the Ren API for driving Astra programmatically.",
};

export default function ApiReferencePage() {
  return (
    <article>
      <DocHeader
        eyebrow="Develop"
        title="API reference"
        intro="The Ren API lets you drive Astra programmatically over a single, stable HTTPS endpoint. Authenticate with your Ren API key and send a request — there's no SDK to install and nothing else to configure."
      />

      <DocCallout label="Preview">
        The programmatic API is in active development. This page documents the
        shape it takes today; capabilities will be finalized before general
        availability. See{" "}
        <Link href="/api" className="text-bronze-deep underline-offset-4 hover:underline">
          Ren API
        </Link>{" "}
        for the platform overview.
      </DocCallout>

      <DocH2>Authentication</DocH2>
      <DocP>
        Every request carries your Ren API key as a bearer token. Create and
        manage keys in your{" "}
        <Link
          href="/console"
          className="text-bronze-deep underline-offset-4 hover:underline"
        >
          API console
        </Link>
        . Keep keys on the server — never ship one to a browser or commit it to a
        repository.
      </DocP>
      <DocCode title="Authorization header" language="http">{`Authorization: Bearer $REN_API_KEY`}</DocCode>

      <DocH2>Sending a message</DocH2>
      <DocP>
        Post a list of messages to the Astra endpoint and set the model id to{" "}
        <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px] text-ink">
          astra
        </code>
        . Set{" "}
        <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px] text-ink">
          stream
        </code>{" "}
        to receive the reply as server-sent events as it is generated.
      </DocP>
      <DocCode title="Request" language="bash">{`curl https://api.ren.ai/v1/messages \\
  -H "Authorization: Bearer $REN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "astra",
    "stream": true,
    "messages": [
      { "role": "user", "content": "Explain how billing pagination works in this repo." }
    ]
  }'`}</DocCode>

      <DocH2>From your code</DocH2>
      <DocP>
        Any language that can make an HTTPS request can call Astra — no client
        library required. Here it is with the built-in <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px] text-ink">fetch</code>,
        reading the stream as it arrives.
      </DocP>
      <DocCode title="TypeScript" language="ts">{`const res = await fetch("https://api.ren.ai/v1/messages", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.REN_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "astra",
    stream: true,
    messages: [
      { role: "user", content: "Refactor the cursor pagination to coalesce nulls." },
    ],
  }),
});

// Astra streams the reply as server-sent events — read them as they arrive.
const reader = res.body!.getReader();
const decoder = new TextDecoder();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}`}</DocCode>

      <DocH2>Planned capabilities</DocH2>
      <DocList
        items={[
          <>Repository understanding over a connected codebase.</>,
          <>Code generation and architecture analysis.</>,
          <>Pull request creation as an API operation.</>,
          <>Agent workflows that plan, run, and verify multi-step changes.</>,
        ]}
      />

      <DocPager href="/docs/api-reference" />
    </article>
  );
}
