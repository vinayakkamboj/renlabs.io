/**
 * POST /api/billing/webhook — Stripe fulfillment.
 *
 * The ONLY place credits are granted for money. Signature-verified against
 * STRIPE_WEBHOOK_SECRET (raw body, before any parsing), fulfilled through the
 * same atomic admin_grant_credits RPC the admin panel uses, and idempotent:
 * a session id that already appears in the credit ledger is acknowledged
 * without granting again (Stripe retries deliveries; users must not be
 * double-credited).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createAdminClient, isAdminDbConfigured } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "payments_not_configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return Response.json({ received: true });

  const userId = session.metadata?.user_id;
  const packId = session.metadata?.pack_id ?? "unknown";
  const credits = parseInt(session.metadata?.credits ?? "", 10);
  if (!userId || !Number.isInteger(credits) || credits <= 0) {
    // Malformed metadata — acknowledge (retrying won't fix it) but log loudly.
    console.error("[stripe-webhook] bad metadata on session", session.id);
    return Response.json({ received: true });
  }

  if (!isAdminDbConfigured()) {
    // Retryable — Stripe will redeliver once the service key is configured.
    return Response.json({ error: "db_not_configured" }, { status: 500 });
  }

  const db = createAdminClient();

  // Idempotency: the session id is embedded in the ledger note; if it's
  // already there, this delivery is a retry — acknowledge without granting.
  const { data: existing } = await db
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .like("description", `%${session.id}%`)
    .limit(1);
  if (existing?.length) return Response.json({ received: true, duplicate: true });

  const { error } = await db.rpc("admin_grant_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_note: `Stripe purchase: ${packId} pack (${session.id})`,
    p_actor: "stripe-webhook",
  });
  if (error) {
    // 500 → Stripe retries with backoff, so a transient DB failure self-heals.
    console.error("[stripe-webhook] grant failed", session.id, error.message);
    return Response.json({ error: "grant_failed" }, { status: 500 });
  }

  return Response.json({ received: true, credited: credits });
}
