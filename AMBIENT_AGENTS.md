# Ambient Agents — Research & Strategy Doc

> Living document. Add findings here as research continues. Started 2026-07-18.
> Scope: planning only — no implementation decisions are final until validated.

---

## 1. The Verdict First: Can This Make Money?

**Yes — this is a real, fast-growing market. Whether it's *our* billion-dollar
outcome depends entirely on execution against a specific failure pattern that
is killing everyone else (Section 3).**

### Market evidence

- The AI agents market grew from **$5.25B (2024) → $7.84B (2025)**, projected
  to hit **$52.6B by 2030** (~46% CAGR).
- Agentic AI startups raised **$2.66B across 44 rounds** through April 2026
  (vs $1.09B same period prior year). July 2026 alone: **$1.8B across 12+ deals**.
- Proof of revenue exists: Harvey (legal agents) at $35M ARR, Glean at $150M+
  ARR, Sierra charging **$150K+/yr contracts** on outcome pricing,
  11x.ai charging **$5,000/month per agent seat**.

### The honest caveats

- Gartner predicts **40%+ of agentic AI projects will be scrapped by 2027**
  (cost, unclear value, weak risk controls).
- Only ~**23% of agent projects reach production**; ~77% die in the
  demo-to-production transition.
- First-generation "AI employee" companies (e.g. Artisan's AI SDRs) report
  **low response rates and high customer churn** — they sold the dream before
  the reliability existed.

### So is it a billion-dollar idea?

The *category* is billion-dollar (multiple $B+ valuations already exist:
Sierra, Cognition/Devin, Harvey). The realistic framing for us:

- **Winnable outcome:** a $10–100M ARR business selling autonomous agents to
  startups, built on top of Ren Code's existing builder + project context.
  That is genuinely achievable because we own the codebase context, which
  standalone agent companies don't.
- **Billion-dollar outcome requires:** winning on *reliability + trust*, not
  features. Every failed competitor had more features than reliability.
- **Rule of thumb from the market:** vertical/specific beats general. "Agents
  that maintain and grow the app you built on Ren" is specific. "AI employees
  for anything" is the graveyard.

**Decision: proceed. The money is real, the differentiation path is clear,
and we already have 60% of the substrate built (Section 5).**

---

## 2. What "Ambient Agent" Actually Means (Our Definition)

An ambient agent:

1. **Runs without being prompted** — a scheduler wakes it; it prompts itself.
2. **Decides its own next task** from goals + project state + past work
   (self-directed planning, not a fixed script).
3. **Works within hard guardrails** — budget, scope, permissions, working
   hours — set once by the owner.
4. **Escalates instead of guessing** — when confidence is low it produces a
   question/approval request, not a wrong action.
5. **Leaves an audit trail** — every cycle produces a report a human can skim
   in 30 seconds.

This matches LangChain's published "ambient agents" concept (agents triggered
by events/schedules, communicating via notify/question/review patterns rather
than chat), which is useful validation that the pattern has industry backing.

---

## 3. Why Everyone Else Is Failing (Design Around These)

This is the most important section. Each failure mode below maps to a design
requirement for us.

### 3.1 Compounding errors — THE killer

- Best models complete only **~24% of real-world multi-step tasks on first
  attempt** (APEX-Agents 2026 benchmark).
- 95% per-step accuracy over a 10-step chain ≈ **60% task success**. Ambient
  agents run hundreds of steps per day unattended.

**→ Our requirement:** short cycles with verification between them. Never one
long 50-step run. Each cycle: plan → act (few steps) → **verify → checkpoint
→ report**. A failed verification rolls back, it doesn't propagate. (Our
build loop already has `detectFatalIssues()` + repair passes — same idea,
generalized.)

### 3.2 Silent failures

Agents complete tasks confidently while wrong: bad tool params, misread
instructions, errors propagated downstream without any signal.

**→ Our requirement:** every cycle ends in a *machine-checkable* outcome
(build passes, test passes, lint passes, preview renders) plus a
human-readable report. "The agent says it worked" is never the success
signal. Self-grading against the goal before marking done.

### 3.3 Demo-to-production gap

Demos have clean inputs and controlled environments. Production has messy
state, partial failures, concurrent edits.

**→ Our requirement:** durable execution. Crash mid-cycle must resume or
cleanly abort — never leave a half-applied change. (Claim-based scheduling in
`agent-scheduler.ts` already prevents double-runs; we need the same rigor for
mid-cycle state.)

### 3.4 Runaway cost

Autonomous loops that burn tokens with no value ceiling. This scrapped many
enterprise projects (the Gartner 40%).

**→ Our requirement:** already largely built — per-run token caps, daily
budgets, burn-rate throttling, auto-pause after 3 consecutive failures. Keep
and extend: **cost-per-outcome tracking** so the owner sees "$1.40 spent →
2 bugs fixed" not just "$1.40 spent."

### 3.5 Fuzzy accountability / trust collapse

When an agent acts alone and something breaks, the customer churns. First-gen
AI-employee firms (Artisan et al.) have high churn precisely because output
quality didn't match the "employee" promise.

**→ Our requirement:** graduated autonomy (Section 6.4) — agents *earn*
autonomy per project. Everything is reviewable, revertible (git history),
and attributable to a specific agent cycle.

### 3.6 Overselling the "AI employee" framing

The term sets an expectation of human-level judgment which then breaks. It
also draws "replacing people" backlash (see the Artisan "stop hiring humans"
billboard controversy).

**→ Our requirement:** never say "AI employee." Candidate vocabulary:

| Term | Feel | Notes |
|---|---|---|
| **Ambient agents** | technical, credible | current site term — good for devs |
| **Autonomous crew / workforce** | product-y | `workforce.ts` already exists |
| **Teammates** | friendly | used by Lindy et al., getting crowded |
| **Ren Ops / on-call agents** | ops framing | "your project, staffed" |
| **Digital staff** | neutral | less baggage than "employee" |

Positioning line to test: **"Your project keeps building itself while you
sleep — with receipts."** Sells outcome + trust, promises no human replacement.

---

## 4. Competitive Landscape

### 4.1 App builders (our direct arena)

| Player | Autonomy today | Weakness we can exploit |
|---|---|---|
| **Lovable** (8M+ users) | Agent Mode: explores code, debugs, web-searches — but session-bound, user-initiated | No true ambient/scheduled operation; agent works *while you watch* |
| **Replit Agent 3** | "10x autonomy", browser testing, background tasks, can spawn sub-agents | Tied to Replit hosting/IDE; complexity overwhelms non-devs |
| **Bolt.new / v0** | Chat-loop builders | Little to no background autonomy |
| **Emergent** | Full-stack + mobile generation | Same session-bound model |
| **Cursor** | Background agents ($16–200/mo tiers) | Developer tool, not a product-owner tool |
| **Devin (Cognition)** | Multi-day autonomous engineering | Expensive, engineer-targeted, no app-builder integration |

**The gap:** nobody in the app-builder space offers *persistent, scheduled,
self-prompting agents attached to the user's own project*. Lovable's agent
stops when the tab closes. Ours keeps working. That is the wedge —
"Lovable builds when you ask. Ren builds while you're gone."

### 4.2 "AI employee" companies (positioning lessons, not direct competitors)

- **Sierra** (Bret Taylor): outcome-based pricing — charge only on resolved
  outcomes. $150K+/yr contracts. Lesson: **price the outcome, not the tokens.**
- **11x.ai**: $5K/month per agent seat, anchored at 10–30% of the equivalent
  human salary. Lesson: seat pricing works when the role is well-defined.
- **Artisan**: $25M raised, but low response quality → churn; now piloting
  success-based pricing via Paid.ai. Lesson: pricing model can't rescue
  reliability.
- **Harvey / Sierra / Hippocratic** dominate *because they're vertical*.
  Lesson: our vertical is "the app you built on Ren" — deep, not broad.

---

## 5. Where We Are Today (Codebase Audit)

Already built (stronger than expected — this is a real head start):

- **Domain model** (`src/lib/data/agents.ts`): 7 roles, status/task/report/
  activity types, working hours + timezone logic, token budgets.
- **Ambient scheduler** (`src/lib/actions/agent-scheduler.ts`): cron +
  in-app ticks, atomic claim-based locking (no double runs), backoff,
  self-healing claim windows. This is genuinely production-grade thinking.
- **Runner** (`src/lib/actions/agent-runner.ts`, 949 lines): the cycle
  executor.
- **Guardrails on the model**: `loopEnabled`, `rateTokensPerMin`,
  `maxTokensPerRun`, `dailyTokenBudget`, `consecutiveFailures` auto-pause,
  `instructions` (constitution), `focus` (scope).
- **UI**: agents tab in workspace (`agent-workspace.tsx`), deploy modal,
  task queue, activity feed, reports, dashboard pages.

Known problems to investigate (the "it doesn't work right now"):

- [ ] **Only 3 agents supported / agents tab broken** — audit
  `agent-workspace.tsx` + `workforce.ts` + `flags.ts` for the cap and the
  breakage; document root cause here before fixing.
- [ ] Does the runner actually *self-prompt* (choose its next task from goals
  + state), or does it just re-run a fixed goal? Self-directed task selection
  is the core of ambient behavior.
- [ ] Is there any verification step after a cycle (build/test/preview
  check), or does a cycle "succeed" whenever the model returns?
- [ ] Memory: does cycle N know what cycle N−1 did beyond the report table?

---

## 6. Target Architecture (The Plan)

### 6.1 The self-prompting loop (heart of the system)

Each scheduled cycle, the agent composes **its own prompt** from:

```
IDENTITY      role preset + owner instructions (constitution) + focus/scope
GOALS         owner-set goals for this agent
MEMORY        summary of past cycles (what worked, what's pending, what failed)
PROJECT STATE file tree summary, recent commits/patches, open tasks, errors,
              preview/build status
BUDGET        tokens remaining today, time window remaining
```

Then a fixed cycle contract:

```
1. OBSERVE   read state; diff since last cycle
2. DECIDE    pick ONE task (existing queued task, or self-generate one that
             serves the goals; write down WHY)
3. ACT       execute in bounded steps (cap per cycle)
4. VERIFY    machine checks: build/tests/lint/preview + self-grade vs goal
5. RECORD    report + memory update + task status + next_run_at
   └─ on verify-fail: revert, log lesson to memory, maybe escalate
```

One task per cycle. Small cycles compound *progress*; long runs compound
*errors* (Section 3.1).

### 6.2 Memory (what makes cycle 100 smarter than cycle 1)

Three layers, all in Supabase (no new infra needed):

1. **Working memory** — current cycle only (in the prompt).
2. **Episodic** — rolling compressed summary of recent cycles ("changelog +
   lessons"), regenerated when it grows past a size cap.
3. **Semantic / lessons** — durable facts the agent has learned about this
   project ("owner prefers Tailwind, never inline styles", "checkout flow is
   fragile — always run its test"). Written explicitly at RECORD time; small,
   curated, injected every cycle.

This is the moat: an agent that has lived in a project for a month should be
visibly better at it than a fresh one. Competitors' session-bound agents
reset to zero every time.

### 6.3 Verification (the trust engine)

- Reuse the build loop's repair machinery (`detectFatalIssues`) as cycle
  gate 1.
- Add per-project checks the agent must pass: build compiles, Sandpack
  renders without console errors, (later) generated smoke tests.
- Self-grade step: model re-reads the goal + diff and scores whether the
  change serves the goal; low score = don't mark done.
- Every code change lands as a revertible patch with the cycle id attached.

### 6.4 Graduated autonomy (the trust ladder)

| Level | Behavior | Promotion criteria |
|---|---|---|
| L0 Suggest | drafts changes; owner applies | default for new agents |
| L1 Act + review | applies changes; owner notified, easy 1-click revert | N clean cycles at L0 |
| L2 Ambient | full loop, escalates only on low confidence | N clean cycles at L1, owner opt-in |

Autonomy is *earned per agent per project* and demotes automatically on
failures. This single mechanism answers the trust/accountability failure mode
and becomes a marketing story ("agents earn your trust").

### 6.5 Escalation channel (ambient ≠ silent)

Three outbound message types (mirrors LangChain's ambient-agent patterns):

- **Notify** — "done X, here's the diff" (no action needed)
- **Question** — "goal ambiguous: A or B?" (agent blocked-waiting, cheap)
- **Approve** — "want to do X, it's destructive/outside scope — confirm"

Delivered in-app first; email/Slack later. An ambient agent that never
surfaces anything reads as dead; one that pings constantly reads as needy.
Default: one digest per day + immediate pings only for Question/Approve.

### 6.6 Multi-agent coordination (later, not now)

With >1 agent per project: shared task queue is the coordination surface
(already exists). QA agent files tasks; developer agent claims them. No
agent-to-agent chat — tasks and reports are the protocol. Keep it boring.

---

## 7. Build vs. Buy: Technology Options

| Option | What it gives | Verdict |
|---|---|---|
| **Keep custom stack** (current: Next.js + Supabase + cron ticks) | Full control, already 60% built, zero new deps | **Default choice.** The scheduler/claim system is already the hard part |
| **LangGraph** | Graph workflows, checkpointing, HITL interrupts, memory store | Steal the *patterns* (checkpointing, interrupt-resume); adopting the framework means rewriting the runner for marginal gain |
| **Temporal** | Industrial durable execution | Overkill until cycles are long-running and multi-service; revisit at scale |
| **Claude Agent SDK** | Prompt-caching, tool loops, subagents, MCP | Worth evaluating for the *runner internals* (the act/verify steps) — we already speak Anthropic throughout |
| **Managed agent platforms** | Speed | No — the agent loop IS the product; outsourcing it means no moat |

**Recommendation:** custom loop + Supabase persistence (own the moat), borrow
LangGraph's checkpoint/interrupt design, evaluate Claude Agent SDK inside the
ACT step only.

---

## 8. Monetization Plan

Layered pricing — matches how trust develops:

1. **Included teaser** (existing plans): 1 agent, L0 suggest-mode, daily runs.
   Purpose: everyone experiences "it worked while I was gone" once.
2. **Agent seats**: per active ambient agent slot, ~$20–50/mo each (market
   anchors: 11x $5K/seat for sales roles; Cursor $16–200/mo for dev tools —
   startup app-builder segment sits near the Cursor end at first).
3. **Usage floor**: token budgets already metered per agent — sell budget
   packs on top of seats (existing `credits/config.ts` machinery).
4. **Outcome experiments** (later, the Sierra lesson): price per *merged,
   verified change* or per resolved task. Only possible because of Section
   6.3 verification — **outcome pricing requires outcome measurement, which
   is another reason verification is the core investment.**

Cost discipline: cheap models (Astra Flash/Flow) for OBSERVE/DECIDE/RECORD;
expensive models only inside ACT for hard tasks. Ambient margin dies if every
cycle runs the premium model.

North-star metric: **verified outcomes per dollar** — the number that must
beat "hire a freelancer" and beat Lovable's cost-per-result.

---

## 9. Roadmap (Phases, No Dates Yet)

**Phase 0 — Make what exists work.** Fix the agents tab; remove/raise the
3-agent cap deliberately (cap by plan, not by bug); audit the runner against
Section 6.1 and write findings here.

**Phase 1 — Trustworthy single ambient agent.** Full cycle contract
(observe→decide→act→verify→record), memory layers, L0/L1 autonomy, daily
digest. One agent that reliably improves a project daily beats seven that
don't.

**Phase 2 — Prove value with 5–10 design partners.** Startups already on Ren.
Measure: verified outcomes/week, revert rate, digest-open rate, "did you
notice useful work you didn't ask for?" Weekly interviews → notes appended
here.

**Phase 3 — The crew.** Multi-agent via shared task queue, L2 autonomy,
escalation channels beyond in-app, seat pricing live.

**Phase 4 — Outcome pricing + scale.** Only after revert rate is provably
low.

---

## 10. Open Research Questions (Keep Appending)

- [ ] Root cause of current agents-tab breakage (Phase 0 audit → findings here)
- [ ] Cost per ambient cycle by model tier — measure, then set default budgets
- [ ] What % of self-generated tasks do owners consider valuable? (design-partner metric)
- [ ] Legal/safety: what actions must ALWAYS require approval? (deploys, deletions, emails, payments)
- [ ] Benchmark: run our loop against APEX-style multi-step tasks; know our own compounding-error curve
- [ ] Watch: Lovable/Replit shipping scheduled agents (erodes wedge — track monthly)
- [ ] Naming test: "ambient agents" vs "crew" vs "digital staff" with real users

---

## 11. Sources

- [MarketsandMarkets — AI Agents Market Report 2025–2030](https://www.marketsandmarkets.com/Market-Reports/ai-agents-market-15761548.html)
- [AI Agent Funding 2026 — aifunding.me](https://aifunding.me/ai-agent-funding) · [July 2026 trends](https://aifunding.me/insights/ai-agent-funding-july-2026)
- [Agentic AI Funding Trends — New Market Pitch](https://newmarketpitch.com/blogs/news/agentic-ai-funding-trends)
- [Why AI Agents Fail in Production: The Reliability Gap in 2026 — Inovabeing](https://www.inovabeing.com/blog/ai-agent-reliability-production-failure-2026)
- [The Compounding Error Problem — Prodigal](https://www.prodigaltech.com/blog/why-most-ai-agents-fail-in-production)
- [Autonomous AI Agents Production Gap (77% never ship) — Umesh Malik](https://umesh-malik.com/blog/autonomous-ai-agents-production-gap-2026)
- [Towards a Science of AI Agent Reliability (arXiv)](https://arxiv.org/pdf/2602.16666)
- [Introducing Ambient Agents — LangChain](https://www.langchain.com/blog/introducing-ambient-agents)
- [LangGraph durable execution & HITL — LangChain docs](https://docs.langchain.com/oss/python/langgraph/overview)
- [Outcome-based pricing for AI Agents — Sierra](https://sierra.ai/blog/outcome-based-pricing-for-ai-agents)
- [How to Price AI Agents: Seat, Tool, or Teammate? — Tierly](https://tierly.app/blog/how-to-price-ai-agents)
- [Artisan raises $25M ("stop hiring humans") — TechCrunch](https://techcrunch.com/2025/04/09/artisan-the-stop-hiring-humans-ai-agent-startup-raises-25m-and-is-still-hiring-humans/)
- [8 AI Platforms for Building Apps in 2026 — Lovable](https://lovable.dev/guides/top-ai-platforms-app-development-2026)
- [Best Lovable Alternatives 2026 — builder.io](https://www.builder.io/blog/lovable-alternatives)
- [Best AI App Builders 2026 — ToolChase](https://toolchase.com/blog/best-ai-app-builders-2026/)
