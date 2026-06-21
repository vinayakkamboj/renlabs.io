import { isAdminDbConfigured, createAdminClient } from "@/lib/supabase/admin";
import { AdminConfigNotice } from "@/components/platform/admin-config-notice";

export const metadata = { title: "Usage & revenue" };
export const dynamic = "force-dynamic";

interface Tx {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  build_usage: "Build",
  purchase: "Purchase",
  signup_bonus: "Signup bonus",
  refund: "Refund",
};

export default async function AdminUsagePage() {
  if (!isAdminDbConfigured()) return <AdminConfigNotice />;

  const db = createAdminClient();
  const { data } = await db
    .from("credit_transactions")
    .select("id, amount, type, description, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data as Tx[]) ?? [];
  const purchased = rows
    .filter((r) => r.type === "purchase")
    .reduce((a, r) => a + r.amount, 0);
  const spent = rows
    .filter((r) => r.type === "build_usage")
    .reduce((a, r) => a + Math.abs(r.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
          Usage &amp; revenue
        </h1>
        <p className="mt-1.5 text-[13.5px] text-dusk-muted">
          Recent credit ledger across all accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Credits purchased (recent)" value={purchased.toLocaleString()} />
        <Stat label="Credits spent (recent)" value={spent.toLocaleString()} />
        <Stat label="Revenue (est.)" value={`$${(purchased * 0.01).toFixed(2)}`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-carbon-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-carbon-line bg-carbon-raised text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-line/60">
            {rows.map((t) => (
              <tr key={t.id} className="bg-carbon-raised hover:bg-carbon-high/40">
                <td className="px-4 py-3 text-dusk-faint">
                  {new Date(t.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-dusk-muted">
                  {TYPE_LABEL[t.type] ?? t.type}
                </td>
                <td className="px-4 py-3 text-dusk-muted">{t.description ?? "—"}</td>
                <td
                  className={`px-4 py-3 text-right font-mono tnum ${
                    t.amount > 0 ? "text-signal-green" : "text-dusk-muted"
                  }`}
                >
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </td>
              </tr>
            ))}
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
