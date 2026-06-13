import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2 } from "lucide-react";
import { PageHeader, EmptyState, DataTable, StatusBadge } from "@/components/platform/widgets";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function ProjectsPage() {
  let projects: Array<{
    id: string;
    name: string;
    kind: string;
    status: string;
    description: string | null;
    repository_id: string | null;
    updated_at: string;
  }> = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    try {
      const { data } = await supabase
        .from("projects")
        .select("id, name, kind, status, description, repository_id, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      projects = data ?? [];
    } catch {
      // Table may not exist yet in development
      projects = [];
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Applications you are building with Ren Code — new ones from a prompt, or work on connected repositories."
        action={
          <Link
            href="/dashboard/projects/new"
            className="flex h-9 items-center rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep"
          >
            New project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Start a new application from a prompt, or open a project on a repository you've connected."
          action={{ label: "Start a new project", href: "/dashboard/projects/new" }}
        />
      ) : (
        <DataTable
          headers={["Project", "Type", "Status", "Updated"]}
          rows={projects.map((p) => [
            <Link
              key="n"
              href={`/dashboard/projects/${p.id}`}
              className="font-medium text-dusk hover:text-brass transition-colors"
            >
              {p.name}
            </Link>,
            p.kind === "new" ? "New build" : "Repository",
            <StatusBadge key="s" status={p.status} />,
            relativeTime(p.updated_at),
          ])}
        />
      )}
    </>
  );
}
