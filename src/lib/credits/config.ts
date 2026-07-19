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
// ~10k output tokens) costs us ~$0.17 in API spend. We charge 40 credits
// ($0.40 at the base $0.01/credit rate) per build.
//
// Margin target: at least ~2x our cost on EVERY plan. The purchase packs below
// give larger bonuses to bigger plans, which lowers the effective price per
// credit — so the bonuses are capped (0–20%) to keep even the top "Studio"
// plan above a ~2x margin. See the per-pack margin notes.
//
export const CREDITS_PER_BUILD: Record<ModelTierId, number> = {
  v1: 40, // Astra v1 — $0.40 list vs ~$0.17 cost ≈ 2.35x at the base rate
};

// ---------------------------------------------------------------------------
// Autonomous agents
// ---------------------------------------------------------------------------
//
// Each autonomous agent run makes several model calls (work + repair + reflect),
// so it costs roughly a build. Charged to the user's Ren credit balance — agents
// spend the same credits the user buys, never free compute.
export const CREDITS_PER_AGENT_RUN = 40;

// Default per-agent credit budget set when a team is deployed. A budget of 0
// means "no per-agent cap" (still limited by the user's overall balance); a
// positive budget caps how many of the user's credits that one agent may spend.
// 1000 credits ≈ 25 runs at the rate above.
export const DEFAULT_AGENT_BUDGET_CREDITS = 1000;

// ---------------------------------------------------------------------------
// Free tier — new accounts get 50 free credits (NOT a free generation).
// Builds burn those credits at the real usage-based rate below; when they run
// out, the user is asked to buy credits. No unmetered builds.
// ---------------------------------------------------------------------------
export const FREE_GENERATIONS = 0;

/** Credits granted once at signup. ~1-2 typical builds at usage-based rates. */
export const SIGNUP_BONUS_CREDITS = 50;

// ---------------------------------------------------------------------------
// Usage-based pricing — credits are charged from ACTUAL token consumption,
// pass by pass, not a flat fee per build. This is what guarantees no loss:
// every charged credit is derived from measured Fireworks tokens times a
// margin. All knobs are env-tunable so price changes never need a deploy.
//
//   cost_usd = (in_tokens * IN_$_PER_M + out_tokens * OUT_$_PER_M) / 1e6
//   credits  = ceil(cost_usd * MARGIN / USD_PER_CREDIT), minimum 1
//
// Defaults: GLM 5.2 serverless list pricing, 1 credit = $0.01, 3x margin.
// ---------------------------------------------------------------------------
const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function creditsForUsage(inputTokens: number, outputTokens: number): number {
  const inPerM = num("FIREWORKS_INPUT_USD_PER_M", 0.55);
  const outPerM = num("FIREWORKS_OUTPUT_USD_PER_M", 2.19);
  const usdPerCredit = num("REN_USD_PER_CREDIT", 0.01);
  const margin = num("REN_BILLING_MARGIN", 3);
  const costUsd =
    (Math.max(0, inputTokens) * inPerM + Math.max(0, outputTokens) * outPerM) / 1_000_000;
  return Math.max(1, Math.ceil((costUsd * margin) / usdPerCredit));
}

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
  /** Bonus credits above base (base = priceCents, since 1 credit = 1 cent) */
  bonusCredits: number;
  /** True = most popular / recommended */
  featured?: boolean;
}

// 1 credit = $0.01 (1 US cent).
//
// Bonuses are tuned so the effective $/build stays ≈ 2x our ~$0.17 cost:
//   Starter  $5  → 500 cr  (0%)  → $0.40/build ≈ 2.35x
//   Growth   $15 → 1,650 cr (10%) → $0.36/build ≈ 2.14x
//   Pro      $50 → 5,750 cr (15%) → $0.35/build ≈ 2.05x
//   Studio   $150 → 18,000 cr (20%) → $0.33/build ≈ 1.96x
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Kick the tyres on Ren Code",
    priceCents: 500,          // $5.00
    credits: 500,             // no bonus
    bonusCredits: 0,
  },
  {
    id: "growth",
    name: "Growth",
    description: "For regular builders shipping side projects",
    priceCents: 1500,         // $15.00
    credits: 1650,            // 10% bonus
    bonusCredits: 150,
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious, day-to-day product work",
    priceCents: 5000,         // $50.00
    credits: 5750,            // 15% bonus
    bonusCredits: 750,
  },
  {
    id: "studio",
    name: "Studio",
    description: "For teams and studios building continuously",
    priceCents: 15000,        // $150.00
    credits: 18000,           // 20% bonus
    bonusCredits: 3000,
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
