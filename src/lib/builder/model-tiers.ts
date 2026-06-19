/**
 * Astra model — the single user-facing builder model.
 *
 * The UI shows one model, "Astra v1". The build API route resolves it to the
 * underlying model id server-side and never exposes that id to the client. The
 * tier abstraction is intentionally collapsed to one entry: simpler for users,
 * and still leaves room to add capability levels later without a rewrite.
 */

export type ModelTierId = "v1";

export interface ModelTier {
  id: ModelTierId;
  brandName: string;
  tagline: string;
  modelId: string;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    id: "v1",
    brandName: "Astra v1",
    tagline: "Ren Labs' autonomous builder — plans, writes, and ships your app",
    modelId: "claude-sonnet-4-6",
  },
];

export const ASTRA_MODEL = MODEL_TIERS[0];

export const DEFAULT_MODEL_TIER: ModelTierId = "v1";

export function resolveModelTier(tierId: string | undefined | null): ModelTier {
  return MODEL_TIERS.find((t) => t.id === tierId) ?? ASTRA_MODEL;
}

export function getTierBrandName(tierId: string | undefined | null): string {
  return resolveModelTier(tierId).brandName;
}
