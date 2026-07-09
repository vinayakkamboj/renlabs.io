"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { requestAccess } from "@/lib/actions/access";

/** Trial-request form on /restricted — one note field, one click. */
export function RequestAccessForm() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    setPending(true);
    const res = await requestAccess(note);
    setPending(false);
    if (res.ok) {
      toast.success("Trial request sent");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not send the request");
    }
  }

  return (
    <div className="rounded-xl border border-carbon-line bg-carbon-raised p-4 text-left">
      <label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
        What are you planning to build? (optional)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="A dashboard for my startup, a game, an internal tool…"
        className="mt-2 w-full resize-none rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brass text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "Sending…" : "Request trial access"}
      </button>
    </div>
  );
}
