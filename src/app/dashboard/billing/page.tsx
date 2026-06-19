import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Coins, Check } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCreditsBalance, ensureCreditsAccount } from "@/lib/credits/server";
import {
  CREDIT_PACKS,
  CREDITS_PER_BUILD,
  SIGNUP_BONUS_CREDITS,
  formatCredits,
  packPriceUSD,
} from "@/lib/credits/config";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const TIER_INFO = [
  {
    id: "v1",
    name: "Astra v1",
    desc: "Plans, writes, and ships your app",
    credits: CREDITS_PER_BUILD.v1,
  },
];

export default async function BillingPage() {
  let balance: number | null = null;
  let recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    tier: string | null;
    description: string | null;
    balance_after: number;
    created_at: string;
  }> = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    await ensureCreditsAccount(user.id);
    balance = await getCreditsBalance(user.id);

    try {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, type, tier, description, balance_after, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      recentTransactions = data ?? [];
    } catch {
      /* table may not exist yet */
    }
  }

  return (
    <div className="space-y-8">
      {/* Balance hero */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-carbon-line bg-carbon-raised p-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
            Available credits
          </p>
          <p className="mt-1.5 font-serif text-[3rem] leading-none text-dusk tnum">
            {balance !== null ? formatCredits(balance) : "—"}
          </p>
          <p className="mt-2 text-[13px] text-dusk-muted">
            ≈ ${balance !== null ? (balance / 100).toFixed(2) : "0.00"} USD value · 1 credit = $0.01
          </p>
        </div>
        <div className="rounded-xl border border-carbon-line bg-carbon px-5 py-4 text-right">
          <p className="text-[12px] text-dusk-faint">Free credit on signup</p>
          <p className="mt-0.5 font-serif text-[1.5rem] text-brass tnum">
            {SIGNUP_BONUS_CREDITS}
          </p>
          <p className="mt-0.5 text-[11.5px] text-dusk-faint">= $1.00 of builds</p>
        </div>
      </div>

      {/* Credit packs */}
      <section>
        <h2 className="mb-1 font-serif text-[1.2rem] text-dusk">Buy Ren Credits</h2>
        <p className="mb-5 text-[13px] text-dusk-muted">
          Credits never expire. Larger packs include bonus credits.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col overflow-hidden rounded-xl border bg-carbon-raised p-5 ${
                pack.featured
                  ? "border-brass"
                  : "border-carbon-line"
              }`}
            >
              {pack.featured && (
                <span className="absolute right-3 top-3 rounded-full bg-brass px-2 py-0.5 text-[10.5px] font-medium text-carbon">
                  Popular
                </span>
              )}
              <p className="text-[14px] font-semibold text-dusk">{pack.name}</p>
              <p className="mt-0.5 text-[12px] text-dusk-faint">{pack.description}</p>
              <div className="mt-4">
                <span className="font-serif text-[2rem] leading-none text-dusk tnum">
                  {packPriceUSD(pack)}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <p className="flex items-center gap-1.5 text-[12.5px] text-dusk">
                  <Coins className="size-3.5 text-brass" />
                  {formatCredits(pack.credits)} credits
                </p>
                {pack.bonusCredits > 0 && (
                  <p className="flex items-center gap-1.5 text-[12px] text-brass">
                    <Check className="size-3 shrink-0" />
                    +{formatCredits(pack.bonusCredits)} bonus
                  </p>
                )}
              </div>
              <button
                disabled
                className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brass/20 text-[12.5px] font-medium text-brass/60 cursor-not-allowed"
                title="Payment integration coming soon"
              >
                Coming soon
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-dusk-faint">
          Payment processing will be available soon. To purchase credits now,{" "}
          <a href="mailto:credits@ren.ai" className="text-brass transition-colors hover:text-brass-deep">
            contact us
          </a>
          .
        </p>
      </section>

      {/* Per-build pricing */}
      <section>
        <h2 className="mb-1 font-serif text-[1.2rem] text-dusk">Cost per build</h2>
        <p className="mb-4 text-[13px] text-dusk-muted">
          Credits are deducted once per message you send to Astra.
        </p>
        <div className="overflow-hidden rounded-xl border border-carbon-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-carbon-line bg-carbon-raised">
                <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
                  Tier
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
                  Credits/build
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">
                  USD equiv.
                </th>
                <th className="hidden px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint sm:table-cell">
                  Best for
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-line/60">
              {TIER_INFO.map(({ name, desc, credits }) => (
                <tr key={name} className="bg-carbon-raised hover:bg-carbon-high/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-dusk">{name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-dusk tnum">{credits}</td>
                  <td className="px-4 py-3 font-mono text-dusk-muted tnum">
                    ${(credits / 100).toFixed(2)}
                  </td>
                  <td className="hidden px-4 py-3 text-dusk-faint sm:table-cell">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transaction history */}
      <section>
        <h2 className="mb-4 font-serif text-[1.2rem] text-dusk">Usage history</h2>
        {recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-carbon-line py-10 text-center">
            <Coins className="size-6 text-dusk-faint/40" />
            <p className="mt-3 text-[13px] text-dusk-muted">No transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-carbon-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-carbon-line bg-carbon-raised">
                  <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">Date</th>
                  <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">Description</th>
                  <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">Credits</th>
                  <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-widest text-dusk-faint">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-line/60">
                {recentTransactions.map((t) => (
                  <tr key={t.id} className="bg-carbon-raised hover:bg-carbon-high/50">
                    <td className="px-4 py-3 text-dusk-faint">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-dusk-muted">
                      {t.description ?? txLabel(t.type, t.tier)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tnum ${t.amount > 0 ? "text-brass" : "text-dusk-muted"}`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-dusk tnum">
                      {t.balance_after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function txLabel(type: string, tier: string | null): string {
  if (type === "signup_bonus") return "Free signup credit";
  if (type === "purchase") return "Credit purchase";
  if (type === "build_usage") return `Build · Astra ${tierName(tier)}`;
  if (type === "refund") return "Refund";
  return type;
}

function tierName(tier: string | null): string {
  // Current model plus legacy tier ids kept for historical transaction rows.
  const map: Record<string, string> = {
    v1: "v1",
    spark: "Flash",
    flow: "Flow",
    forge: "Pro",
    apex: "Max",
  };
  return map[tier ?? ""] ?? tier ?? "";
}
