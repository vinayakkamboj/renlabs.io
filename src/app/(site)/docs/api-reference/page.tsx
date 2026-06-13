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
        intro="The Ren API lets you drive Astra programmatically. The model is served behind a stable, OpenAI-compatible endpoint, so existing tooling works with a base URL and a model id."
      />

      <DocCallout label="Preview">
        The programmatic API is in active development. This page documents the
        shape it takes today; capabilities and authentication will be finalized
        before general availability. See{" "}
        <Link href="/api" className="text-bronze-deep underline-offset-4 hover:underline">
          Ren API
        </Link>{" "}
        for the platform overview.
      </DocCallout>

      <DocH2>Authentication</DocH2>
      <DocP>
        Requests are authenticated with a bearer token. Keep your key on the
        server — never ship it to a browser or commit it to a repository.
      </DocP>
      <DocCode title="Authorization header" language="http">{`Authorization: Bearer $REN_API_KEY`}</DocCode>

      <DocH2>Chat completions</DocH2>
      <DocP>
        Astra speaks the OpenAI-compatible chat completions format. Point your
        client at the Ren base URL and set the model id to{" "}
        <code className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[13px] text-ink">
          astra
        </code>
        .
      </DocP>
      <DocCode title="Request" language="bash">{`curl https://api.ren.ai/v1/chat/completions \\
  -H "Authorization: Bearer $REN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "astra",
    "messages": [
      { "role": "user", "content": "Explain how billing pagination works in this repo." }
    ],
    "stream": true
  }'`}</DocCode>

      <DocH2>Using an existing SDK</DocH2>
      <DocP>
        Because the endpoint is OpenAI-compatible, you can use the official
        OpenAI client libraries by overriding the base URL.
      </DocP>
      <DocCode title="TypeScript" language="ts">{`import OpenAI from "openai";

const ren = new OpenAI({
  apiKey: process.env.REN_API_KEY,
  baseURL: "https://api.ren.ai/v1",
});

const stream = await ren.chat.completions.create({
  model: "astra",
  stream: true,
  messages: [{ role: "user", content: "Refactor the cursor pagination to coalesce nulls." }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
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
