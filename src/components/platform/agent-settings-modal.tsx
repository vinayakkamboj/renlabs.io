"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { updateAgentSettings } from "@/lib/actions/agents";
import type { Agent, AgentSchedule } from "@/lib/data/agents";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong";

const SCHEDULES: { value: AgentSchedule; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HourSelect({
  value,
  onChange,
  anyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  anyLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(INPUT, "appearance-none")}
    >
      <option value="">{anyLabel}</option>
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={String(h)}>
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

export function DayPicker({
  days,
  onToggle,
}: {
  days: number[];
  onToggle: (d: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAY_LABELS.map((label, d) => {
        const active = days.includes(d);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(d)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors",
              active
                ? "border-brass/50 bg-brass/10 text-brass"
                : "border-carbon-line text-dusk-faint hover:border-carbon-line-strong hover:text-dusk-muted",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
      {children}
    </span>
  );
}

/**
 * "Configure" button + modal for an existing agent. Everything the owner can
 * customize lives here: what the agent works on (goal, scope), the rules it
 * follows every run, its working hours, and its token consumption caps.
 */
export function AgentSettingsButton({
  agent,
  compact,
}: {
  agent: Agent;
  /** Smaller footprint for dense rows (workspace agent cards). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-carbon-line font-medium text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk",
          compact ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-[12px]",
        )}
      >
        <Settings2 className={compact ? "size-3" : "size-3.5"} />
        Configure
      </button>
      {open && <SettingsModal agent={agent} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(agent.name);
  const [goal, setGoal] = useState(agent.goal ?? "");
  const [focus, setFocus] = useState(agent.focus ?? "");
  const [instructions, setInstructions] = useState(agent.instructions ?? "");
  const [schedule, setSchedule] = useState<AgentSchedule>(agent.schedule);
  const [budget, setBudget] = useState(
    agent.budgetCents > 0 ? String(agent.budgetCents / 100) : "",
  );
  const [hoursStart, setHoursStart] = useState(
    agent.workingHoursStart != null ? String(agent.workingHoursStart) : "",
  );
  const [hoursEnd, setHoursEnd] = useState(
    agent.workingHoursEnd != null ? String(agent.workingHoursEnd) : "",
  );
  const [days, setDays] = useState<number[]>(agent.workingDays ?? []);
  const [maxPerRun, setMaxPerRun] = useState(String(agent.maxTokensPerRun));
  const [dailyBudget, setDailyBudget] = useState(
    agent.dailyTokenBudget != null ? String(agent.dailyTokenBudget) : "",
  );
  const [loop, setLoop] = useState(agent.loopEnabled);
  const [rate, setRate] = useState(String(agent.rateTokensPerMin));
  const [pending, setPending] = useState(false);

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    const res = await updateAgentSettings(agent.id, {
      name,
      goal,
      focus,
      instructions,
      schedule,
      budgetCents: Math.max(0, Math.round((parseFloat(budget) || 0) * 100)),
      workingHoursStart: hoursStart === "" ? null : Number(hoursStart),
      workingHoursEnd: hoursEnd === "" ? null : Number(hoursEnd),
      workingDays: days.length ? days : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      maxTokensPerRun: parseInt(maxPerRun, 10) || 12000,
      dailyTokenBudget: dailyBudget === "" ? null : parseInt(dailyBudget, 10) || null,
      loopEnabled: loop,
      rateTokensPerMin: parseInt(rate, 10) || 1500,
    });
    setPending(false);
    if (res.ok) {
      toast.success("Agent configuration saved");
      onClose();
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not save configuration");
    }
  }

  const hoursSet = hoursStart !== "" && hoursEnd !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
              <Settings2 className="size-4 text-brass" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-dusk">Configure {agent.name}</p>
              <p className="text-[11.5px] text-dusk-faint">
                Rules, scope, working hours, and token limits
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

        <div className="platform-scroll space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Agent name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={cn(INPUT, "mt-2")} />
            </div>
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
          </div>

          <div>
            <Label>Goal — what the agent works toward</Label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className={cn(INPUT, "mt-2 resize-none")}
              placeholder="What should this agent accomplish?"
            />
          </div>

          <div>
            <Label>Scope — what it may touch</Label>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className={cn(INPUT, "mt-2")}
              placeholder='e.g. "only the checkout flow" or "docs and copy, never code"'
            />
          </div>

          <div>
            <Label>Rules — followed on every run</Label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className={cn(INPUT, "mt-2 resize-none")}
              placeholder={"One rule per line, e.g.\nNever remove existing features.\nKeep bundle size in mind.\nWrite tests for new logic."}
            />
          </div>

          {/* Working hours */}
          <div className="rounded-xl border border-carbon-line bg-carbon p-4">
            <Label>Working hours</Label>
            <p className="mt-1 text-[11.5px] text-dusk-faint">
              The ambient loop only runs inside this window (your timezone). Manual runs
              always work. Leave unset for around-the-clock.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <HourSelect value={hoursStart} onChange={setHoursStart} anyLabel="Any start" />
              <HourSelect value={hoursEnd} onChange={setHoursEnd} anyLabel="Any end" />
            </div>
            {hoursStart !== "" && hoursEnd === "" && (
              <p className="mt-2 text-[11px] text-signal-amber">
                Pick an end hour too — a window needs both ends.
              </p>
            )}
            <div className="mt-3">
              <DayPicker days={days} onToggle={toggleDay} />
              <p className="mt-1.5 text-[11px] text-dusk-faint">
                {days.length ? "Runs only on the selected days." : "No days selected — runs every day."}
              </p>
            </div>
            {hoursSet && (
              <p className="mt-2 text-[11px] text-dusk-muted">
                Window: {String(hoursStart).padStart(2, "0")}:00 – {String(hoursEnd).padStart(2, "0")}:00
              </p>
            )}
          </div>

          {/* Token consumption */}
          <div className="rounded-xl border border-carbon-line bg-carbon p-4">
            <Label>Token consumption</Label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Max per run</Label>
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
                <Label>Daily budget</Label>
                <input
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className={cn(INPUT, "mt-2")}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Burn rate (tokens/min)</Label>
                <select
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className={cn(INPUT, "mt-2 appearance-none")}
                >
                  <option value="500">500 — slow &amp; cheap</option>
                  <option value="1500">1,500 — balanced</option>
                  <option value="4000">4,000 — fast</option>
                  <option value="10000">10,000 — flat out</option>
                </select>
              </div>
              <div>
                <Label>Budget (USD)</Label>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  className={cn(INPUT, "mt-2")}
                  placeholder="No cap"
                />
              </div>
            </div>
          </div>

          {/* Ambient loop */}
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-carbon-line bg-carbon p-4">
            <div>
              <p className="text-[13px] font-medium text-dusk">Ambient loop</p>
              <p className="mt-0.5 text-[11.5px] text-dusk-faint">
                Runs continuously on the ren branch within the limits above.
              </p>
            </div>
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="size-4 accent-brass"
            />
          </label>
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
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {pending ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
