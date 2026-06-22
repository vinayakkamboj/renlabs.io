import Link from "next/link";
import { getAdminUser } from "@/lib/auth/admin";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

interface Profile {
  id: string;
  email: string | null;
  role: string | null;
  created_at: string;
}
interface CreditInfo {
  user_id: string;
  balance: number;
  free_generations: number;
  lifetime_used: number;
}

export default async function AdminUsersPage() {
  if (!(await getAdminUser())) return null;
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const db = createAdminClient();
  const [{ data: profiles }, { data: credits }] = await Promise.all([
    db
      .from("profiles")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("user_credits").select("user_id, balance, free_generations, lifetime_used"),
  ]);

  const creditMap = new Map<string, CreditInfo>(
    ((credits as CreditInfo[]) ?? []).map((c) => [c.user_id, c]),
  );
  const rows = (profiles as Profile[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">Users</h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          {rows.length} most recent accounts.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-carbon-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-carbon-line bg-carbon-raised text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Credits</th>
              <th className="px-4 py-3 text-right">Free</th>
              <th className="px-4 py-3 text-right">Used</th>
              <th className="hidden px-4 py-3 sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-line/60">
            {rows.map((p) => {
              const c = creditMap.get(p.id);
              return (
                <tr key={p.id} className="bg-carbon-raised hover:bg-carbon-high/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${p.id}`}
                      className="text-dusk underline-offset-2 hover:text-brass hover:underline"
                    >
                      {p.email ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.role === "admin"
                          ? "rounded-full bg-brass/15 px-2 py-0.5 text-[11px] text-brass"
                          : "text-dusk-faint"
                      }
                    >
                      {p.role ?? "member"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-dusk tnum">
                    {(c?.balance ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-dusk-muted tnum">
                    {c?.free_generations ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-dusk-faint tnum">
                    {(c?.lifetime_used ?? 0).toLocaleString()}
                  </td>
                  <td className="hidden px-4 py-3 text-dusk-faint sm:table-cell">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
