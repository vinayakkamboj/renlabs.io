import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminUser } from "@/lib/auth/admin";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";
import { AdminUserManager } from "@/components/platform/admin-user-manager";

export const metadata = { title: "User" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const admin = await getAdminUser();
  if (!admin) return null; // layout renders the denial UI
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const { id } = await params;
  const db = createAdminClient();

  const [{ data: profile }, { data: credits }, { data: txs }, { count: projectCount }] =
    await Promise.all([
      db.from("profiles").select("id, email, role, created_at").eq("id", id).single(),
      db
        .from("user_credits")
        .select("balance, free_generations, lifetime_used, lifetime_purchased")
        .eq("user_id", id)
        .single(),
      db
        .from("credit_transactions")
        .select("id, amount, type, description, balance_after, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      db.from("projects").select("id", { count: "exact", head: true }).eq("user_id", id),
    ]);

  if (!profile) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-[14px] text-dusk-muted">User not found.</p>
      </div>
    );
  }

  const c = credits ?? {
    balance: 0,
    free_generations: 0,
    lifetime_used: 0,
    lifetime_purchased: 0,
  };

  const stats = [
    { label: "Balance", value: c.balance.toLocaleString() },
    { label: "Free gens", value: String(c.free_generations) },
    { label: "Spent", value: c.lifetime_used.toLocaleString() },
    { label: "Purchased", value: c.lifetime_purchased.toLocaleString() },
    { label: "Projects", value: String(projectCount ?? 0) },
  ];

  return (
    <div className="space-y-7">
      <BackLink />

      <div>
        <h1 className="font-serif text-[1.7rem] leading-tight text-dusk">
          {profile.email ?? "Unknown user"}
        </h1>
        <p className="mt-1 font-mono text-[12px] text-dusk-faint">
          {profile.role ?? "member"} · joined{" "}
          {new Date(profile.created_at).toLocaleDateString()} · {id}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-carbon-line bg-carbon-raised p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
              {s.label}
            </p>
            <p className="mt-1.5 font-serif text-[1.4rem] leading-none text-dusk tnum">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <AdminUserManager
        userId={id}
        balance={c.balance}
        freeGenerations={c.free_generations}
        role={profile.role ?? "member"}
        isSuperAdmin={admin.isSuperAdmin}
      />

      {/* Recent ledger */}
      <section>
        <h2 className="mb-3 text-[13px] font-medium text-dusk-muted">
          Recent transactions
        </h2>
        {txs && txs.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-carbon-line">
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-carbon-line/60">
                {txs.map((t) => (
                  <tr key={t.id} className="bg-carbon-raised">
                    <td className="px-4 py-2.5 text-dusk-faint">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-dusk-muted">
                      {t.description ?? t.type}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tnum ${
                        t.amount > 0 ? "text-signal-green" : "text-dusk-muted"
                      }`}
                    >
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-dusk-faint tnum">
                      {t.balance_after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-dusk-faint">No transactions yet.</p>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-1.5 text-[12.5px] text-dusk-faint transition-colors hover:text-dusk"
    >
      <ArrowLeft className="size-3.5" />
      All users
    </Link>
  );
}
