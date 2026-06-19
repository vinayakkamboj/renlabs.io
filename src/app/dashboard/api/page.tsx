import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Terminal } from "lucide-react";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { listApiKeys } from "@/lib/actions/api-keys";
import { ApiKeysManager } from "@/components/platform/api-keys-manager";

export const metadata: Metadata = { title: "API" };
export const dynamic = "force-dynamic";

const QUICKSTART = `curl https://api.ren.ai/v1/messages \\
  -H "Authorization: Bearer $REN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "astra",
    "stream": true,
    "messages": [
      { "role": "user", "content": "What does this repo do?" }
    ]
  }'`;

export default async function ApiConsolePage() {
  let initialKeys = [] as Awaited<ReturnType<typeof listApiKeys>>;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    initialKeys = await listApiKeys();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
            API console
          </h1>
          <p className="mt-1.5 text-[13.5px] text-dusk-muted">
            Create keys and call Astra from your own systems — one endpoint, your
            API key, nothing else to install.
          </p>
        </div>
        <Link
          href="/docs/api-reference"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon-raised px-3.5 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
        >
          API reference
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* Preview notice */}
      <div className="rounded-xl border border-carbon-line bg-carbon-raised px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-dusk-muted">
          <span className="font-medium text-brass">Preview.</span> The programmatic
          API is in active development. You can create and manage keys now; the
          live endpoint is being finalized.
        </p>
      </div>

      {/* Quickstart */}
      <section>
        <div className="overflow-hidden rounded-2xl border border-carbon-line bg-carbon">
          <div className="flex items-center justify-between border-b border-carbon-line px-4 py-2.5">
            <span className="flex items-center gap-2 font-mono text-[11px] text-dusk-muted">
              <Terminal className="size-3.5" />
              quickstart.sh
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal-green">
              ● astra
            </span>
          </div>
          <pre className="platform-scroll overflow-x-auto px-4 py-4">
            <code className="font-mono text-[12px] leading-relaxed text-dusk">
              {QUICKSTART}
            </code>
          </pre>
        </div>
      </section>

      {/* Keys */}
      <ApiKeysManager initialKeys={initialKeys} />
    </div>
  );
}
