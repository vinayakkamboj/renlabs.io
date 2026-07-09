/**
 * POST /api/billing/checkout — start a Stripe Checkout session for a credit pack.
 *
 * The pack (price + credits) is resolved SERVER-SIDE from CREDIT_PACKS by id;
 * the client can only choose which pack, never the price. Fulfillment happens
 * exclusively in the webhook (never on the success redirect, which is
 * spoofable), keyed by the user id we stamp into the session metadata here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { CREDIT_PACKS } from "@/lib/credits/config";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isUserAllowed } from "@/lib/auth/access";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "payments_not_configured" }, { status: 503 });
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  let packId = "";
  try {
    packId = ((await req.json()) as { packId?: string }).packId ?? "";
  } catch {
    /* handled below */
  }
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return Response.json({ error: "unknown_pack" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!(await isUserAllowed(supabase, user.id, user.email))) {
    return Response.json({ error: "private_beta" }, { status: 403 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "https://renlabs.io";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `Ren Credits — ${pack.name}`,
              description: `${pack.credits.toLocaleString()} credits${
                pack.bonusCredits ? ` (includes ${pack.bonusCredits.toLocaleString()} bonus)` : ""
              }`,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${origin}/dashboard/billing?purchase=success`,
      cancel_url: `${origin}/dashboard/billing?purchase=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_error";
    return Response.json({ error: msg.slice(0, 200) }, { status: 502 });
  }
}
