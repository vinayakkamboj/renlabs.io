"use client";

/**
 * Credits readout for the workspace top bar (left side). Shows the live credit
 * balance and, after each build, how many tokens that turn consumed. The balance
 * is seeded from /api/credits/balance and then kept current by the build store,
 * which updates it from the build response headers on every generation.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { useWorkspaceStore } from "@/lib/builder/store";
import { totalTokens } from "@/lib/ai/usage";

/** Compact number formatting: 1234 → 1.2k, 982 → 982. */
function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function CreditsBadge() {
  const storeBalance = useWorkspaceStore((s) => s.creditsBalance);
  const lastUsage = useWorkspaceStore((s) => s.lastUsage);
  const [apiBalance, setApiBalance] = useState<number | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/credits/balance")
      .then((r) => r.json())
      .then((d: { balance?: number | null; configured?: boolean }) => {
        if (!alive) return;
        setApiBalance(d.balance ?? null);
        setConfigured(d.configured !== false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Store balance wins once a build has reported it; otherwise use the API seed.
  const balance = storeBalance ?? apiBalance;

  if (!configured) return null;

  return (
    <Link
      href="/dashboard/billing"
      title="Available credits — manage billing"
      className="hidden shrink-0 items-center gap-2 rounded-full border border-carbon-line bg-carbon-raised px-2.5 py-1 transition-colors hover:border-carbon-line-strong sm:flex"
    >
      <Coins className="size-3.5 text-brass" />
      <span className="text-[11.5px] font-medium text-dusk">
        {balance === null ? "—" : balance.toLocaleString()}
      </span>
      <span className="text-[11px] text-dusk-faint">credits</span>
      {lastUsage && totalTokens(lastUsage) > 0 && (
        <span className="ml-0.5 flex items-center gap-1 border-l border-carbon-line pl-2 font-mono text-[10.5px] text-dusk-muted">
          {compact(totalTokens(lastUsage))} tok
          {lastUsage.creditsDeducted ? (
            <span className="text-signal-amber">−{lastUsage.creditsDeducted}</span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
