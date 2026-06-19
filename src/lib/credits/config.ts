/**
 * Ren Credit System — pricing configuration.
 *
 * 1 Ren Credit = $0.01 USD.
 * Costs are per build call and reflect a ~100% markup over Anthropic API
 * costs (input + output), giving margin to cover hosting, support, and profit.
 *
 * NEVER import this on the client — it contains pricing logic that informs
 * server-side gating. The client only needs the credit *balance*, not the
 * underlying cost structure.
 */

import type { ModelTierId } from "@/lib/builder/model-tiers";

// ---------------------------------------------------------------------------
// Per-build credit cost
// ---------------------------------------------------------------------------
//
// Astra v1 runs on Sonnet-class capability. A typical build (~8k input +
// ~10k output tokens) costs ~$0.17 in API spend; we charge 35 credits ($0.35),
// roughly a 100% markup to cover hosting, support, and margin.
//
export const CREDITS_PER_BUILD: Record<ModelTierId, number> = {
  v1: 35, // Astra v1
};

// ---------------------------------------------------------------------------
// Free credits awarded on signup
// ---------------------------------------------------------------------------
export const SIGNUP_BONUS_CREDITS = 100; // worth $1

// ---------------------------------------------------------------------------
// Credit purchase packs
// ---------------------------------------------------------------------------
export interface CreditPack {
  id: string;
  name: string;
  description: string;
  /** Price in USD cents */
  priceCents: number;
  /** Credits included */
  credits: number;
  /** Bonus credits above base (base = priceCents / CENTS_PER_CREDIT) */
  bonusCredits: number;
  /** True = most popular / recommended */
  featured?: boolean;
}

const CENTS_PER_CREDIT = 1; // 1 credit = $0.01

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Great for trying Ren Code",
    priceCents: 500,          // $5.00
    credits: 550,             // $5.50 value (10% bonus)
    bonusCredits: 50,
  },
  {
    id: "growth",
    name: "Growth",
    description: "For regular builders",
    priceCents: 1500,         // $15.00
    credits: 1800,            // $18.00 value (20% bonus)
    bonusCredits: 300,
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious projects",
    priceCents: 5000,         // $50.00
    credits: 7000,            // $70.00 value (40% bonus)
    bonusCredits: 2000,
  },
  {
    id: "studio",
    name: "Studio",
    description: "For teams and studios",
    priceCents: 15000,        // $150.00
    credits: 24000,           // $240.00 value (60% bonus)
    bonusCredits: 9000,
  },
];

export function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function packPriceUSD(pack: CreditPack): string {
  return `$${(pack.priceCents / 100).toFixed(2)}`;
}

/** How many Flash/Flow builds does a pack cover? */
export function buildsInPack(pack: CreditPack, tier: ModelTierId): number {
  return Math.floor(pack.credits / CREDITS_PER_BUILD[tier]);
}
