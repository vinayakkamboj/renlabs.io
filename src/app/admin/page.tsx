import {
  Users,
  FolderGit2,
  Sparkles,
  Coins,
  KeyRound,
  Gift,
  DollarSign,
} from "lucide-react";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = createAdminClient();

  const [usersR, projectsR, buildsR, keysR, creditRowsR] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("projects").select("id", { count: "exact", head: true }),
    db
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("type", "build_usage"),
    db.from("api_keys").select("id", { count: "exact", head: true }),
    db
      .from("user_credits")
      .select("balance, lifetime_used, lifetime_purchased, free_generations"),
  ]);

  const creditRows =
    (creditRowsR.data as
      | {
          balance: number;
          lifetime_used: number;
          lifetime_purchased: number;
          free_generations: number;
        }[]
      | null) ?? [];

  const creditsUsed = creditRows.reduce((a, r) => a + (r.lifetime_used ?? 0), 0);
  const creditsPurchased = creditRows.reduce(
    (a, r) => a + (r.lifetime_purchased ?? 0),
    0,
  );
  const freeRemaining = creditRows.reduce(
    (a, r) => a + (r.free_generations ?? 0),
    0,
  );

  return {
    users: usersR.count ?? 0,
    projects: projectsR.count ?? 0,
    builds: buildsR.count ?? 0,
    apiKeys: keysR.count ?? 0,
    creditsUsed,
    creditsPurchased,
    freeRemaining,
    revenue: creditsPurchased * 0.01,
  };
}

export default async function AdminOverviewPage() {
  if (!(await getAdminUser())) return null;
  if (!isAdminDbConfigured()) {
    return <ServiceRoleNotice />;
  }

  const s = await getStats();

  const cards = [
    { label: "Users", value: s.users.toLocaleString(), icon: Users },
    { label: "Projects", value: s.projects.toLocaleString(), icon: FolderGit2 },
    { label: "Builds run", value: s.builds.toLocaleString(), icon: Sparkles },
    { label: "API keys", value: s.apiKeys.toLocaleString(), icon: KeyRound },
    {
      label: "Credits spent",
      value: s.creditsUsed.toLocaleString(),
      icon: Coins,
    },
    {
      label: "Free gens left",
      value: s.freeRemaining.toLocaleString(),
      icon: Gift,
    },
    {
      label: "Credits purchased",
      value: s.creditsPurchased.toLocaleString(),
      icon: Coins,
    },
    {
      label: "Revenue (est.)",
      value: `$${s.revenue.toFixed(2)}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Overview
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          Live platform metrics across all accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-carbon-line bg-carbon-raised p-5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
                {c.label}
              </span>
              <c.icon className="size-3.5 text-brass" />
            </div>
            <p className="mt-3 font-serif text-[1.9rem] leading-none text-dusk tnum">
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceRoleNotice() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Admin
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          One step left to enable platform-wide metrics.
        </p>
      </div>
      <div className="rounded-2xl border border-signal-amber/30 bg-signal-amber/[0.06] p-5">
        <p className="text-[13.5px] font-medium text-dusk">
          Service role key not configured
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dusk-muted">
          Reading data across all users requires a service-role key. Set{" "}
          <code className="rounded bg-carbon px-1.5 py-0.5 font-mono text-[12px] text-brass">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          on the server (Supabase → Project Settings → API → service_role secret),
          and{" "}
          <code className="rounded bg-carbon px-1.5 py-0.5 font-mono text-[12px] text-brass">
            ADMIN_EMAILS
          </code>{" "}
          to a comma-separated allowlist of admin emails. Never expose the
          service-role key with a{" "}
          <code className="rounded bg-carbon px-1.5 py-0.5 font-mono text-[12px] text-brass">
            NEXT_PUBLIC_
          </code>{" "}
          prefix.
        </p>
      </div>
    </div>
  );
}
