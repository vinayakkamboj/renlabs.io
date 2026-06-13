import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Github } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
  DataTable,
  StatusBadge,
} from "@/components/platform/widgets";
import { RepoPicker } from "@/components/platform/repo-picker";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";

export const metadata: Metadata = { title: "Repositories" };
export const dynamic = "force-dynamic";

interface RepoRow {
  id: string;
  full_name: string;
  default_branch: string;
  language: string | null;
  is_private: boolean;
  index_state: string;
  last_synced_at: string | null;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function RepositoriesPage() {
  let repositories: RepoRow[] = [];
  let githubConnected = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const cookieStore = await cookies();
    githubConnected = readGitHubSession(cookieStore) !== null;

    try {
      const { data } = await supabase
        .from("repositories")
        .select(
          "id, full_name, default_branch, language, is_private, index_state, last_synced_at",
        )
        .eq("user_id", user.id)
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      repositories = data ?? [];
    } catch {
      repositories = [];
    }
  }

  return (
    <>
      <PageHeader
        title="Connected repositories"
        description="Repositories Ren Code can read. Access is granted per repository and revocable at any time."
      />

      {repositories.length === 0 ? (
        <EmptyState
          icon={Github}
          title="No repositories connected"
          description="Connect your GitHub account and choose exactly which repositories Ren Code can index and understand."
          action={{ label: "Connect GitHub", href: "/dashboard/integrations" }}
        />
      ) : (
        <DataTable
          headers={["Repository", "Branch", "Language", "Visibility", "Index", "Synced"]}
          rows={repositories.map((r) => [
            <Link
              key="n"
              href={`/dashboard/repositories/${r.id}`}
              className="font-mono text-[12.5px] text-dusk transition-colors hover:text-brass"
            >
              {r.full_name}
            </Link>,
            r.default_branch,
            r.language ?? "—",
            r.is_private ? "Private" : "Public",
            <StatusBadge key="i" status={r.index_state} />,
            relativeTime(r.last_synced_at),
          ])}
        />
      )}

      <div className="mt-8">
        <h2 className="font-serif text-[1.2rem] text-dusk">Add repositories</h2>
        <p className="mt-1 text-[13px] text-dusk-muted">
          {githubConnected
            ? "Pick repositories from your GitHub account to make them available to Ren Code."
            : "Connect GitHub to choose repositories Ren Code can read."}
        </p>

        <div className="mt-4">
          {githubConnected ? (
            <RepoPicker existing={repositories.map((r) => r.full_name)} />
          ) : (
            <Panel>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13.5px] text-dusk-muted">
                  GitHub isn’t connected yet.
                </p>
                <Link
                  href="/dashboard/integrations"
                  className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-dusk px-4 text-[12.5px] font-medium text-carbon transition-opacity hover:opacity-90"
                >
                  <Github className="size-4" />
                  Connect GitHub
                </Link>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
