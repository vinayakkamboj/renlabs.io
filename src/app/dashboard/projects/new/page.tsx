import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/platform/widgets";
import { NewProjectFlow } from "@/components/platform/new-project-flow";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";

export const metadata: Metadata = { title: "New project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  let githubConnected = false;
  let repositories: { id: string; fullName: string }[] = [];

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
        .select("id, full_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      repositories = (data ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
      }));
    } catch {
      repositories = [];
    }
  }

  return (
    <>
      <PageHeader
        title="New project"
        description="Choose how you want to start. Describe a new application, or build on a repository you've connected."
      />
      <NewProjectFlow
        githubConnected={githubConnected}
        repositories={repositories}
      />
    </>
  );
}
