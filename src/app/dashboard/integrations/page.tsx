import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Database } from "lucide-react";
import { PageHeader, Panel } from "@/components/platform/widgets";
import { GithubConnect } from "@/components/platform/github-connect";
import { SupabaseConnect } from "@/components/platform/supabase-connect";
import { isGitHubConfigured, readGitHubSession } from "@/lib/github/session";
import { getSupabaseIntegration, getSupabaseSchema } from "@/lib/actions/integrations";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const configured = isGitHubConfigured();
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore);

  // Fetch Supabase integration and schema (if connected) in parallel.
  const integration = await getSupabaseIntegration();
  const schemaResult = integration ? await getSupabaseSchema() : null;
  const initialTables = schemaResult?.ok ? (schemaResult.tables ?? null) : null;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect the services Ren agents work with. GitHub powers the repository workflow; your own Supabase project gives agents schema context."
      />

      <div className="space-y-6">
        {/* Supabase backend integration */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Database className="size-3.5 text-brass" />
                Supabase backend
              </span>
            }
          >
            <SupabaseConnect
              integration={integration}
              initialTables={initialTables}
            />
          </Panel>

          <Panel title="Why connect your Supabase?">
            <ol className="space-y-4">
              {[
                {
                  n: "01",
                  t: "Schema awareness",
                  d: "Agents read your table definitions and relationships so they generate correct SQL, Supabase queries, and typed TypeScript.",
                },
                {
                  n: "02",
                  t: "Migration generation",
                  d: "Ask an agent to add a column or create a table — it writes and explains the migration before anything runs.",
                },
                {
                  n: "03",
                  t: "Typed queries",
                  d: "With your schema, agents produce correctly typed Supabase client calls that match your actual data model.",
                },
                {
                  n: "04",
                  t: "Never writes without you",
                  d: "Agents only read the schema. No data is modified, read, or transmitted without a task you explicitly queue.",
                },
              ].map((s) => (
                <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="font-mono text-[11.5px] text-brass">{s.n}</span>
                  <div>
                    <p className="text-[13.5px] font-medium text-dusk">{s.t}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">
                      {s.d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {/* GitHub */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense>
            <GithubConnect
              configured={configured}
              connected={session !== null}
              login={session?.login ?? null}
              connectedAt={session?.connectedAt ?? null}
            />
          </Suspense>

          <Panel title="How repository access works">
            <ol className="space-y-4">
              {[
                {
                  n: "01",
                  t: "Authorize",
                  d: "Connect through GitHub OAuth. We request the minimum scopes needed and show them up front.",
                },
                {
                  n: "02",
                  t: "Add repositories",
                  d: "Pick exactly which repositories Ren can read. Nothing is touched until you choose it.",
                },
                {
                  n: "03",
                  t: "Index & analyze",
                  d: "Selected repos are analyzed so agents understand structure, stack, and conventions.",
                },
                {
                  n: "04",
                  t: "Revoke anytime",
                  d: "Disconnect or narrow access from here or from your GitHub settings whenever you want.",
                },
              ].map((s) => (
                <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="font-mono text-[11.5px] text-brass">{s.n}</span>
                  <div>
                    <p className="text-[13.5px] font-medium text-dusk">{s.t}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">
                      {s.d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
