"use client";

/**
 * Business brief editor. The brief is the shared context every agent in the
 * workspace reads — what the business does, who it serves, the product, the
 * constraints — so an engineer, QA, designer, or ops agent all build toward the
 * same understanding. Saving it changes how every agent reasons on its next run.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProjectBrief } from "@/lib/actions/projects";

interface Props {
  projectId: string;
  initialBrief: string | null;
}

const PLACEHOLDER = `Describe the business so agents can act on their own. For example:

We're a DTC coffee brand selling single-origin subscriptions to home brewers in the US. Customers care about freshness, provenance, and easy plan management. The product is a storefront + subscription dashboard. Tone is warm and editorial. Priorities: smooth checkout, clear sourcing stories, and reducing churn.`;

export function BriefEditor({ projectId, initialBrief }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [brief, setBrief] = useState(initialBrief ?? "");
  const dirty = brief !== (initialBrief ?? "");

  function save() {
    startSave(async () => {
      const res = await updateProjectBrief(projectId, brief);
      if (res.ok) {
        toast.success("Business brief saved — agents will use it on their next run.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save the brief.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={7}
        placeholder={PLACEHOLDER}
        className="w-full resize-y rounded-xl border border-carbon-line bg-carbon px-3.5 py-3 text-[13px] leading-relaxed text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong"
      />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {saving ? "Saving…" : "Save brief"}
        </button>
      )}
    </div>
  );
}
