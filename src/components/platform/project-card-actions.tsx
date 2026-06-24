"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteProject } from "@/lib/actions/projects";

interface ProjectCardActionsProps {
  projectId: string;
  projectName: string;
}

export function ProjectCardActions({ projectId, projectName }: ProjectCardActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await deleteProject(projectId);
      if (res.ok) {
        toast.success("Project deleted");
        setOpen(false);
        setConfirming(false);
        // Stay where we are — the list revalidates and the card drops out.
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not delete project");
      }
    });
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { setOpen((v) => !v); setConfirming(false); }}
        className="flex size-7 items-center justify-center rounded-lg text-dusk-faint opacity-0 transition-all hover:bg-carbon-high hover:text-dusk group-hover:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised shadow-xl">
          <Link
            href={`/workspace/${projectId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] text-dusk-muted transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <ExternalLink className="size-3.5" />
            Open workspace
          </Link>
          <div className="mx-2 border-t border-carbon-line" />
          <button
            onClick={handleDelete}
            disabled={pending}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] transition-colors hover:bg-signal-red/10"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin text-signal-red" />
            ) : (
              <Trash2 className="size-3.5 text-signal-red" />
            )}
            <span className={confirming ? "font-medium text-signal-red" : "text-signal-red/80"}>
              {confirming ? `Delete "${projectName.slice(0, 16)}${projectName.length > 16 ? "…" : ""}"?` : "Delete project"}
            </span>
          </button>
          {confirming && (
            <p className="px-3 pb-2.5 text-[11px] text-dusk-faint/70">
              Click again to confirm. This cannot be undone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
