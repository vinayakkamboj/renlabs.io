import { getAdminUser } from "@/lib/auth/admin";
import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

interface Tx {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default async function AdminPaymentsPage() {
  if (!(await getAdminUser())) return null;
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const db = createAdminClient();
  const { data } = await db
    .from("credit_transactions")
    .select("id, user_id, amount, type, description, created_at")
    .in("type", ["purchase", "admin_grant"])
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = (data as Tx[]) ?? [];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await db
    .from("profiles")
    .select("id, email")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const emailMap = new Map<string, string>(
    ((profiles as { id: string; email: string | null }[]) ?? []).map((p) => [
      p.id,
      p.email ?? "—",
    ]),
  );

  const totalCredits = rows.reduce((a, r) => a + Math.max(r.amount, 0), 0);
  const onlineCredits = rows
    .filter((r) => r.type === "purchase")
    .reduce((a, r) => a + r.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Payments
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          Online purchases and manual grants across all accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Online revenue (est.)" value={`$${(onlineCredits * 0.01).toFixed(2)}`} />
        <Stat label="Credits issued" value={totalCredits.toLocaleString()} />
        <Stat label="Records" value={String(rows.length)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-carbon-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-carbon-line bg-carbon-raised text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3 text-right">Credits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-line/60">
            {rows.map((t) => (
              <tr key={t.id} className="bg-carbon-raised hover:bg-carbon-high/40">
                <td className="px-4 py-3 text-dusk-faint">
                  {new Date(t.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-dusk-muted">
                  {emailMap.get(t.user_id) ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      t.type === "admin_grant"
                        ? "rounded-full bg-brass/15 px-2 py-0.5 text-[11px] text-brass"
                        : "rounded-full bg-signal-green/15 px-2 py-0.5 text-[11px] text-signal-green"
                    }
                  >
                    {t.type === "admin_grant" ? "Manual" : "Online"}
                  </span>
                </td>
                <td className="px-4 py-3 text-dusk-faint">{t.description ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-dusk tnum">
                  +{t.amount}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-dusk-faint">
                  No payments or grants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-carbon-line bg-carbon-raised p-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
        {label}
      </p>
      <p className="mt-3 font-serif text-[1.7rem] leading-none text-dusk tnum">
        {value}
      </p>
    </div>
  );
}
