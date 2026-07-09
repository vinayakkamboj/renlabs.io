"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { decideAccessRequest } from "@/lib/actions/access";

/**
 * Approve / deny buttons for one access request. On a decided request only
 * the opposite action shows, so a mistaken decision is one click to reverse.
 */
export function AccessRequestActions({
  requestId,
  decided,
}: {
  requestId: string;
  decided?: "approved" | "denied" | string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);

  async function decide(approve: boolean) {
    if (pending) return;
    setPending(approve ? "approve" : "deny");
    const res = await decideAccessRequest(requestId, approve);
    setPending(null);
    if (res.ok) {
      toast.success(approve ? "Access granted" : "Request denied");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not update the request");
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {decided !== "approved" && (
        <button
          onClick={() => decide(true)}
          disabled={pending !== null}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-signal-green/15 px-3 text-[12px] font-medium text-signal-green transition-colors hover:bg-signal-green/25 disabled:opacity-50"
        >
          {pending === "approve" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Approve
        </button>
      )}
      {decided !== "denied" && (
        <button
          onClick={() => decide(false)}
          disabled={pending !== null}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line px-3 text-[12px] text-dusk-muted transition-colors hover:border-signal-red/40 hover:text-signal-red disabled:opacity-50"
        >
          {pending === "deny" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
          Deny
        </button>
      )}
    </div>
  );
}
