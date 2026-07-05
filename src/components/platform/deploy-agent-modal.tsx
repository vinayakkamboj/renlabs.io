"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { deployAgent } from "@/lib/actions/agents";
import { DayPicker, HourSelect } from "@/components/platform/agent-settings-modal";
import {
  ROLE_LIST,
  ROLE_PRESETS,
  type AgentRole,
  type AgentSchedule,
} from "@/lib/data/agents";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
}

const SCHEDULES: { value: AgentSchedule; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const INPUT =
  "w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong";

/**
 * Deploy-agent flow. Trigger is a button; opens a modal that picks a role,
 * target project, goal, schedule, and budget, then calls the deployAgent action.
 */
export function DeployAgentButton({
  projects,
  defaultProjectId,
  variant = "primary",
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  const noProjects = projects.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={noProjects}
        title={noProjects ? "Create a project first" : "Deploy an agent"}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-colors disabled:opacity-40",
          variant === "primary"
            ? "bg-brass text-carbon hover:bg-brass-deep"
            : "border border-carbon-line text-dusk-muted hover:border-carbon-line-strong hover:text-dusk",
        )}
      >
        <Plus className="size-3.5" />
        Deploy agent
      </button>
      {open && (
        <DeployModal
          projects={projects}
          defaultProjectId={defaultProjectId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeployModal({
  projects,
  defaultProjectId,
  onClose,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState<AgentRole>("research");
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [name, setName] = useState(ROLE_PRESETS.research.label);
  const [goal, setGoal] = useState(ROLE_PRESETS.research.defaultGoal);
  const [schedule, setSchedule] = useState<AgentSchedule>("manual");
  const [budget, setBudget] = useState("5");
  const [pending, setPending] = useState(false);
  // Advanced customization — rules, scope, working hours, token limits.
  const [advanced, setAdvanced] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [focus, setFocus] = useState("");
  const [hoursStart, setHoursStart] = useState("");
  const [hoursEnd, setHoursEnd] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [maxPerRun, setMaxPerRun] = useState("12000");
  const [dailyBudget, setDailyBudget] = useState("");

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function pickRole(r: AgentRole) {
    setRole(r);
    // Re-seed name/goal from the preset unless the user has clearly customized.
    setName(ROLE_PRESETS[r].label);
    setGoal(ROLE_PRESETS[r].defaultGoal);
  }

  async function submit() {
    if (!projectId || pending) return;
    setPending(true);
    const res = await deployAgent({
      projectId,
      name,
      role,
      goal,
      schedule,
      budgetCents: Math.max(0, Math.round(parseFloat(budget) || 0) * 100),
      instructions,
      focus,
      workingHoursStart: hoursStart === "" ? null : Number(hoursStart),
      workingHoursEnd: hoursEnd === "" ? null : Number(hoursEnd),
      workingDays: days.length ? days : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      maxTokensPerRun: parseInt(maxPerRun, 10) || 12000,
      dailyTokenBudget: dailyBudget === "" ? null : parseInt(dailyBudget, 10) || null,
    });
    setPending(false);
    if (res.ok) {
      toast.success(`${name} deployed`);
      onClose();
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not deploy agent");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
              <Rocket className="size-4 text-brass" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-dusk">Deploy an agent</p>
              <p className="text-[11.5px] text-dusk-faint">
                Assign an AI agent to one of your projects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="platform-scroll space-y-4 overflow-y-auto p-5">
          {/* Role picker */}
          <div>
            <Label>Role</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLE_LIST.map((preset) => {
                const Icon = preset.icon;
                const active = preset.role === role;
                return (
                  <button
                    key={preset.role}
                    onClick={() => pickRole(preset.role)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-brass/50 bg-brass/10"
                        : "border-carbon-line bg-carbon hover:border-carbon-line-strong",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-brass" : "text-dusk-muted")} />
                    <span className="text-[12px] font-medium text-dusk">
                      {preset.label.replace(" Agent", "")}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-dusk-faint">{ROLE_PRESETS[role].blurb}</p>
          </div>

          {/* Project */}
          <div>
            <Label>Project</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={cn(INPUT, "mt-2 appearance-none")}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <Label>Agent name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(INPUT, "mt-2")}
              placeholder="e.g. Research Agent"
            />
          </div>

          {/* Goal */}
          <div>
            <Label>Goal</Label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className={cn(INPUT, "mt-2 resize-none")}
              placeholder="What should this agent accomplish?"
            />
          </div>

          {/* Schedule + budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Schedule</Label>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as AgentSchedule)}
                className={cn(INPUT, "mt-2 appearance-none")}
              >
                {SCHEDULES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Budget (USD)</Label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className={cn(INPUT, "mt-2")}
                placeholder="5"
              />
            </div>
          </div>

          {/* Advanced customization */}
          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="flex w-full items-center justify-between rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
          >
            <span>Rules, working hours &amp; token limits</span>
            <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} />
          </button>

          {advanced && (
            <div className="space-y-4 rounded-xl border border-carbon-line bg-carbon p-4">
              <div>
                <Label>Scope — what it may touch</Label>
                <input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className={cn(INPUT, "mt-2")}
                  placeholder='e.g. "only the checkout flow"'
                />
              </div>
              <div>
                <Label>Rules — followed on every run</Label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  className={cn(INPUT, "mt-2 resize-none")}
                  placeholder={"One rule per line, e.g.\nNever remove existing features.\nAlways keep the design tokens."}
                />
              </div>
              <div>
                <Label>Working hours (your timezone)</Label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <HourSelect value={hoursStart} onChange={setHoursStart} anyLabel="Any start" />
                  <HourSelect value={hoursEnd} onChange={setHoursEnd} anyLabel="Any end" />
                </div>
                <div className="mt-2.5">
                  <DayPicker days={days} onToggle={toggleDay} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max tokens / run</Label>
                  <select
                    value={maxPerRun}
                    onChange={(e) => setMaxPerRun(e.target.value)}
                    className={cn(INPUT, "mt-2 appearance-none")}
                  >
                    <option value="4000">4,000 — light</option>
                    <option value="8000">8,000 — standard</option>
                    <option value="12000">12,000 — heavy</option>
                    <option value="16000">16,000 — max</option>
                  </select>
                </div>
                <div>
                  <Label>Daily token budget</Label>
                  <input
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    className={cn(INPUT, "mt-2")}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-carbon-line px-5 py-3.5">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-carbon-line px-3 py-1.5 text-[12.5px] text-dusk-faint transition-colors hover:text-dusk disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || !projectId}
            className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
            {pending ? "Deploying…" : "Deploy agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
      {children}
    </span>
  );
}
