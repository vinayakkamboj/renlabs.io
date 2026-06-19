/**
 * Astra — Ren AI's flagship large language model. The intelligence layer that
 * powers every Ren AI product; Ren Code is the first application built on it.
 *
 * Hierarchy, maintained everywhere: Ren AI → Astra → Ren Code.
 * No invented benchmarks, release dates, or capabilities.
 */

export const astra = {
  name: "Astra",
  kind: "Advanced Language Model",
  status: "Active Development",
  currentVersion: "Astra v1",

  summary:
    "Astra is Ren AI's flagship language model, designed for reasoning, software engineering, long-context understanding, and agentic workflows. It serves as the intelligence layer powering every Ren AI product.",

  /** The positioning, stated plainly — Astra is the model, Ren Code the product. */
  positioning: [
    "Astra is Ren AI's flagship language model — built for reasoning, software engineering, long-context understanding, and agentic workflows.",
    "It is the intelligence layer powering every Ren AI product. Ren Code is the first application built on Astra, and future products will be powered by Astra as well.",
  ],

  /** The shipping model. Only what's live — no unreleased versions. */
  versions: [
    {
      label: "Astra v1",
      phase: "Current generation",
      state: "current" as const,
      detail: "The model in active development today, powering Ren Code.",
    },
  ],

  /** The Journey of Astra — how the model is built and continuously improved. */
  journey: {
    intro:
      "Astra began as a highly capable foundation model and is being continuously transformed through research, evaluation, training, software engineering workflows, and proprietary development techniques.",
    goal:
      "The goal is not merely to generate code. The goal is to build a language model capable of understanding software systems, reasoning about architecture, and assisting developers throughout the entire engineering lifecycle.",
    loop: [
      {
        title: "Data curation",
        detail: "Assembling and screening high-signal training data from code, diffs, and engineering traces.",
      },
      {
        title: "Model training",
        detail: "Transforming the foundation with proprietary techniques aimed at software reasoning.",
      },
      {
        title: "Evaluation",
        detail: "A fixed, contamination-screened suite run before and after every training cycle.",
      },
      {
        title: "Engineering feedback loops",
        detail: "Findings from real engineering work feed directly back into training priorities.",
      },
      {
        title: "Real-world software workflows",
        detail: "Astra improves where it is actually used — inside real repositories and tasks.",
      },
    ],
  },

  /** Current research focus — areas of the model, not separate products. */
  researchFocus: [
    {
      title: "Software Engineering",
      detail:
        "Resolving real engineering tasks end-to-end, across the files a change actually touches.",
    },
    {
      title: "Reasoning",
      detail:
        "Multi-step problem solving with the discipline to admit uncertainty rather than guess.",
    },
    {
      title: "Agent Systems",
      detail:
        "Planning, executing, and verifying multi-step work, then returning results that hold up.",
    },
    {
      title: "Long Context Understanding",
      detail:
        "Holding large codebases and documents in context so decisions are made globally.",
    },
    {
      title: "Repository Intelligence",
      detail:
        "Understanding architecture, dependencies, and conventions as one connected system.",
    },
    {
      title: "Reliability",
      detail:
        "Calibrated confidence and consistent behavior — a tool you can trust, not double-check.",
    },
  ],
};

export type AstraVersionState = (typeof astra.versions)[number]["state"];
