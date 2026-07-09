"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "Buy" button for a credit pack. Starts a Stripe Checkout session and
 * redirects to Stripe's hosted payment page. When payments aren't configured
 * yet (no STRIPE_SECRET_KEY on the server), renders the dormant state.
 */
export function BuyPackButton({
  packId,
  enabled,
}: {
  packId: string;
  enabled: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function buy() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // navigating away — leave the spinner on
      }
      toast.error(
        data.error === "payments_not_configured"
          ? "Payments aren't live yet."
          : (data.error ?? "Could not start checkout."),
      );
    } catch {
      toast.error("Could not reach the payment service.");
    }
    setPending(false);
  }

  if (!enabled) {
    return (
      <button
        disabled
        className="mt-5 flex h-9 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-brass/20 text-[12.5px] font-medium text-brass/60"
        title="Payments are being set up"
      >
        Coming soon
      </button>
    );
  }

  return (
    <button
      onClick={buy}
      disabled={pending}
      className="mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brass text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
      {pending ? "Opening checkout…" : "Buy"}
    </button>
  );
}
