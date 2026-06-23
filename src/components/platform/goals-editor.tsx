"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { updateProjectGoals } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  initialGoals: string[];
}

export function GoalsEditor({ projectId, initialGoals }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [dirty, setDirty] = useState(false);

  function startEdit(i: number) {
    setEditingIndex(i);
    setEditValue(goals[i]);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      const updated = goals.map((g, i) => (i === editingIndex ? trimmed : g));
      setGoals(updated);
      setDirty(true);
    }
    setEditingIndex(null);
    setEditValue("");
  }

  function removeGoal(i: number) {
    setGoals(goals.filter((_, idx) => idx !== i));
    setDirty(true);
    if (editingIndex === i) setEditingIndex(null);
  }

  function addGoal() {
    const trimmed = newGoal.trim();
    if (!trimmed) return;
    setGoals([...goals, trimmed]);
    setNewGoal("");
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      const res = await updateProjectGoals(projectId, goals);
      if (res.ok) {
        setDirty(false);
        toast.success("Goals saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save goals.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Goal list */}
      {goals.length > 0 && (
        <ul className="space-y-2">
          {goals.map((g, i) => (
            <li key={i} className="group flex items-start gap-2.5">
              <Target className="mt-0.5 size-4 shrink-0 text-brass" />

              {editingIndex === i ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingIndex(null);
                    }}
                    className="h-8 flex-1 rounded-lg border border-carbon-line-strong bg-carbon px-2.5 text-[13px] text-dusk outline-none"
                  />
                  <button
                    onClick={commitEdit}
                    className="flex size-7 items-center justify-center rounded-lg bg-brass/15 text-brass hover:bg-brass/25"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="flex size-7 items-center justify-center rounded-lg text-dusk-faint hover:text-dusk"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-[13.5px] leading-relaxed text-dusk">
                    {g}
                  </span>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(i)}
                      className="flex size-6 items-center justify-center rounded text-dusk-faint transition-colors hover:text-dusk"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => removeGoal(i)}
                      className="flex size-6 items-center justify-center rounded text-dusk-faint transition-colors hover:text-signal-red"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {goals.length === 0 && (
        <p className="text-[13px] text-dusk-faint">
          No goals set yet. Goals give your agents direction for what to work on.
        </p>
      )}

      {/* Add new goal */}
      <div className="flex items-center gap-2">
        <input
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addGoal();
          }}
          placeholder="Add a goal…"
          className="h-9 flex-1 rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
        />
        <button
          onClick={addGoal}
          disabled={!newGoal.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      {/* Save */}
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40",
          )}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {saving ? "Saving…" : "Save goals"}
        </button>
      )}
    </div>
  );
}
