"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import {
  respondToInvitation,
  type IncomingInvitation,
} from "@/lib/actions/collaborators";
import { toast } from "sonner";

export function CollaborationRequests({
  invitations,
}: {
  invitations: IncomingInvitation[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(invitations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function respond(id: string, accept: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = await respondToInvitation(id, accept);
      setBusyId(null);
      if (!res.ok) {
        toast.error("Couldn't update the request. Try again.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(accept ? "Project added to your workspace" : "Request declined");
      router.refresh();
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-dusk-muted">
        Collaboration {items.length === 1 ? "request" : "requests"}
      </h2>
      <div className="space-y-2">
        {items.map((inv) => {
          const busy = busyId === inv.id;
          return (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-xl border border-brass/25 bg-brass/[0.04] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-dusk">
                  <span className="font-medium text-dusk">{inv.invitedByEmail}</span>{" "}
                  invited you to collaborate on{" "}
                  <span className="font-medium text-brass">{inv.projectName}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => respond(inv.id, false)}
                  disabled={busy}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-40"
                >
                  <X className="size-3.5" />
                  Decline
                </button>
                <button
                  onClick={() => respond(inv.id, true)}
                  disabled={busy}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-brass px-3 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Accept
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
