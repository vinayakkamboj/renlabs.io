import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/platform/widgets";
import { ActivityFeed } from "@/components/platform/activity-feed";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listActivity } from "@/lib/actions/agents";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Activity}
        title="Activity is unavailable"
        description="Supabase isn't configured on this deployment."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const events = await listActivity({ limit: 100 });

  return (
    <div>
      <PageHeader
        title="Activity"
        description="A live feed of everything your agents are doing across the workspace — deployments, tasks, and reports as they happen."
      />
      <Panel title="Recent activity">
        <ActivityFeed events={events} />
      </Panel>
    </div>
  );
}
