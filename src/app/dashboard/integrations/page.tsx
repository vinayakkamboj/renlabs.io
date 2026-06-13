import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { PageHeader, Panel } from "@/components/platform/widgets";
import { GithubConnect } from "@/components/platform/github-connect";
import { isGitHubConfigured, readGitHubSession } from "@/lib/github/session";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const configured = isGitHubConfigured();
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore);

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect the services Ren Code works with. GitHub powers the repository workflow."
      />

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
              { n: "01", t: "Authorize", d: "Connect through GitHub OAuth. We request the minimum scopes needed and show them up front." },
              { n: "02", t: "Add repositories", d: "Pick exactly which repositories Ren Code can read. Nothing is touched until you choose it." },
              { n: "03", t: "Index & analyze", d: "Selected repos are analyzed so Astra understands structure, stack, and conventions." },
              { n: "04", t: "Revoke anytime", d: "Disconnect or narrow access from here or from your GitHub settings whenever you want." },
            ].map((s) => (
              <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="font-mono text-[11.5px] text-brass">{s.n}</span>
                <div>
                  <p className="text-[13.5px] font-medium text-dusk">{s.t}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
