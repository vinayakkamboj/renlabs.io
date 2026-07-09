/**
 * Stripe client — server-side only. Payments activate the moment the env keys
 * exist; with no keys the billing UI shows "coming soon" and every payment
 * endpoint answers 503, so the integration ships dormant and is enabled by
 * configuration, not a deploy.
 *
 *   STRIPE_SECRET_KEY      sk_live_… / sk_test_…
 *   STRIPE_WEBHOOK_SECRET  whsec_… (from the dashboard's webhook endpoint)
 */

import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
