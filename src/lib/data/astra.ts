/**
 * Astra — Ren AI's software engineering intelligence system, the technology
 * that powers Ren Code. Presented as a whole-system intelligence, not a code
 * snippet generator. No benchmark claims; progress described honestly.
 */

export const astra = {
  name: "Astra",
  status: "Actively evolving",
  tagline: "Ren AI's advanced software engineering intelligence system.",
  summary:
    "Astra is Ren AI's advanced software engineering intelligence system — developed specifically for repository understanding, architectural reasoning, code generation, pull request creation, software maintenance, and long-context engineering workflows.",
  /** Two paragraphs that position Astra against ordinary code generation. */
  description: [
    "Astra has been extensively trained, evaluated, refined, and optimized for real-world software engineering tasks.",
    "Unlike traditional code generation systems, Astra is designed to understand software systems as a whole rather than generating isolated snippets of code.",
  ],
  /** The intent, stated plainly. */
  mission: [
    "Astra continuously evolves through research, evaluation, and real-world engineering workflows.",
    "Our goal is not simply to generate code. Our goal is to create software engineering intelligence capable of understanding and improving entire software systems.",
  ],
  focusAreas: [
    {
      title: "Repository Understanding",
      detail:
        "Astra reads an entire repository — its architecture, dependencies, and conventions — and reasons about it as one connected system.",
    },
    {
      title: "Architecture Reasoning",
      detail:
        "Understanding how a system fits together: its boundaries, data flows, and the decisions that shaped it.",
    },
    {
      title: "Code Generation",
      detail:
        "Producing changes that read like they belong — consistent with the patterns and idioms already in the codebase.",
    },
    {
      title: "Pull Request Creation",
      detail:
        "Opening reviewable pull requests with a clear account of what changed and why, ready for your team.",
    },
    {
      title: "Software Maintenance",
      detail:
        "Refactoring, repairing, and evolving existing systems while preserving the behavior that already works.",
    },
    {
      title: "Agentic Development",
      detail:
        "Planning multi-step work, running tests, and verifying results before returning them.",
    },
    {
      title: "Long Context Engineering",
      detail:
        "Holding large codebases in context so changes are reasoned about globally, not file by file.",
    },
  ],
  /**
   * How Astra develops — honest, qualitative stages, not invented benchmark
   * numbers. Capability results arrive only with the harness that produces them.
   */
  phases: [
    {
      label: "Training",
      state: "in-progress" as const,
      detail:
        "Astra learns from large-scale software engineering signal — code, reviewed diffs, and verified engineering traces.",
    },
    {
      label: "Capability development",
      state: "in-progress" as const,
      detail:
        "Deepening repository understanding, architectural reasoning, and end-to-end task resolution inside real codebases.",
    },
    {
      label: "Evaluation",
      state: "next" as const,
      detail:
        "A fixed, contamination-screened suite run before and after every training cycle. No claim without a measurement.",
    },
    {
      label: "Continuous refinement",
      state: "next" as const,
      detail:
        "Real-world engineering workflows feed back into training, so Astra improves where it is actually used.",
    },
    {
      label: "Private preview",
      state: "planned" as const,
      detail:
        "Serving Astra inside Ren Code for a small group, working against real repositories.",
    },
  ],
};

export type AstraPhaseState = (typeof astra.phases)[number]["state"];
