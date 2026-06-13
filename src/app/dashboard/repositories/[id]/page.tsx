import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GitBranch, Github, Lock, Unlock } from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/platform/widgets";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";
import {
  buildRepositoryIntelligence,
  type RepositoryIntelligence,
} from "@/lib/ai/repository-intelligence";

export const metadata: Metadata = { title: "Repository" };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RepoRow {
  id: string;
  full_name: string;
  default_branch: string;
  language: string | null;
  is_private: boolean;
  index_state: string;
  last_synced_at: string | null;
}

/** Fetch the recursive git tree from GitHub and return the file paths. */
async function fetchFileTree(
  fullName: string,
  branch: string,
  token: string,
): Promise<string[] | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tree: Array<{ path: string; type: string }>;
    };
    return data.tree.filter((n) => n.type === "blob").map((n) => n.path);
  } catch {
    return null;
  }
}

const TECH_LABELS: Record<string, string> = {
  framework: "Framework",
  language: "Language",
  routing: "Routing",
  styling: "Styling",
  stateManagement: "State",
  database: "Database",
  auth: "Auth",
  orm: "ORM",
  testing: "Testing",
  packageManager: "Package manager",
};

export default async function RepositoryDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isSupabaseConfigured()) redirect("/dashboard/repositories");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: repo, error } = await supabase
    .from("repositories")
    .select(
      "id, full_name, default_branch, language, is_private, index_state, last_synced_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single<RepoRow>();

  if (error || !repo) notFound();

  // Run live intelligence if GitHub is connected.
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore);
  let intelligence: RepositoryIntelligence | null = null;
  let treeError: string | null = null;

  if (session) {
    const paths = await fetchFileTree(
      repo.full_name,
      repo.default_branch,
      session.accessToken,
    );
    if (paths) {
      intelligence = buildRepositoryIntelligence(paths);
    } else {
      treeError =
        "Could not read the file tree from GitHub. The token may have expired, or the branch may be empty.";
    }
  } else {
    treeError = "Connect GitHub to analyze this repository.";
  }

  const roleCounts = intelligence
    ? Object.entries(intelligence.countsByRole)
        .sort((a, b) => b[1] - a[1])
        .filter(([, n]) => n > 0)
    : [];

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/repositories"
          className="inline-flex items-center gap-1.5 text-[13px] text-dusk-muted transition-colors hover:text-dusk"
        >
          <ArrowLeft className="size-3.5" />
          All repositories
        </Link>
      </div>

      <PageHeader
        title={repo.full_name}
        action={<StatusBadge status={repo.index_state} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Repository">
          <dl className="space-y-3.5">
            <div className="flex items-center gap-2">
              {repo.is_private ? (
                <Lock className="size-4 text-dusk-faint" />
              ) : (
                <Unlock className="size-4 text-dusk-faint" />
              )}
              <span className="text-[13.5px] text-dusk">
                {repo.is_private ? "Private" : "Public"} repository
              </span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-dusk-faint" />
              <span className="font-mono text-[12.5px] text-dusk-muted">
                {repo.default_branch}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Github className="size-4 text-dusk-faint" />
              <a
                href={`https://github.com/${repo.full_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12.5px] text-brass hover:underline"
              >
                View on GitHub
              </a>
            </div>
          </dl>
        </Panel>

        {intelligence ? (
          <Panel title="Tech stack">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {Object.entries(TECH_LABELS).map(([key, label]) => {
                const value =
                  intelligence!.techStack[key as keyof typeof intelligence.techStack];
                return (
                  <div key={key}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[13px] text-dusk">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </Panel>
        ) : (
          <Panel title="Repository intelligence">
            <p className="text-[13.5px] leading-relaxed text-dusk-muted">
              {treeError}
            </p>
            {!session ? (
              <Link
                href="/dashboard/integrations"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-dusk px-4 text-[12.5px] font-medium text-carbon transition-opacity hover:opacity-90"
              >
                <Github className="size-4" />
                Connect GitHub
              </Link>
            ) : null}
          </Panel>
        )}
      </div>

      {intelligence ? (
        <>
          <Panel className="mt-4" title="Architecture">
            <p className="text-[13.5px] leading-relaxed text-dusk">
              {intelligence.architecture.description}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Stat label="Scope" value={intelligence.architecture.scope} />
              <Stat label="Files" value={intelligence.files.length} />
              <Stat label="Pages" value={intelligence.architecture.pageCount} />
              <Stat
                label="Components"
                value={intelligence.architecture.componentCount}
              />
            </div>
            {intelligence.architecture.directories.length > 0 ? (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
                  Top-level directories
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {intelligence.architecture.directories.map((d) => (
                    <span
                      key={d}
                      className="rounded-md border border-carbon-line bg-carbon px-2 py-0.5 font-mono text-[11.5px] text-dusk-muted"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Files by role">
              <ul className="space-y-2">
                {roleCounts.map(([role, count]) => (
                  <li
                    key={role}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="capitalize text-dusk-muted">{role}</span>
                    <span className="tnum font-mono text-dusk">{count}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Risks & observations">
              {intelligence.risks.length === 0 ? (
                <p className="text-[13px] text-dusk-muted">
                  No structural risks detected.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {intelligence.risks.map((risk, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[13px] leading-relaxed text-dusk-muted"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal-amber" />
                      {risk}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] capitalize text-dusk">{value}</p>
    </div>
  );
}
