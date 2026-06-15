import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/platform/widgets";
import { NewProjectFlow } from "@/components/platform/new-project-flow";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";

export const metadata: Metadata = { title: "New project" };
export const dynamic = "force-dynamic";

interface NewProjectPageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function NewProjectPage({
  searchParams,
}: NewProjectPageProps) {
  const { mode } = await searchParams;
  const initialMode = mode === "repository" ? "repository" : "new";

  let githubConnected = false;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const cookieStore = await cookies();
    githubConnected = readGitHubSession(cookieStore) !== null;
  }

  return (
    <>
      <PageHeader
        title="New project"
        description="Choose how you want to start — a blank app from a prompt, or pull in one of your GitHub repositories."
      />
      <NewProjectFlow
        githubConnected={githubConnected}
        initialMode={initialMode}
      />
    </>
  );
}
