import { getAdminUser } from "@/lib/auth/admin";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";

export const metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  grant_credits: "Granted credits",
  set_free_generations: "Set free generations",
  set_role: "Changed role",
};

export default async function AdminAuditPage() {
  if (!(await getAdminUser())) return null;
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const db = createAdminClient();
  const { data } = await db
    .from("admin_audit_log")
    .select("id, actor_email, action, target_user_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = (data as AuditRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Audit log
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          Every admin action is recorded here — who did what, and when.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-carbon-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-carbon-line bg-carbon-raised text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-line/60">
            {rows.map((r) => (
              <tr key={r.id} className="bg-carbon-raised hover:bg-carbon-high/40">
                <td className="px-4 py-3 text-dusk-faint">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-dusk-muted">{r.actor_email ?? "—"}</td>
                <td className="px-4 py-3 text-dusk">
                  {ACTION_LABEL[r.action] ?? r.action}
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-dusk-faint">
                  {r.detail ? JSON.stringify(r.detail) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-dusk-faint">
                  No admin actions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
