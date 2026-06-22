/**
 * Astra v1 benchmark results. Astra is Ren Labs' tuned reasoning + coding model;
 * the figures below are its evaluation scores, with a leading open baseline for
 * context. Astra v1 edges ahead across the board thanks to Ren Labs' tuning.
 */

export const ASTRA_VERSION = "Astra v1";

export interface Benchmark {
  name: string;
  full: string;
  astra: number;
  baseline: number;
}

export const BENCHMARKS: Benchmark[] = [
  { name: "MMLU", full: "General knowledge & reasoning", astra: 88.4, baseline: 87.9 },
  { name: "MMLU-Pro", full: "Harder multi-step reasoning", astra: 79.3, baseline: 78.4 },
  { name: "GPQA Diamond", full: "Graduate-level science", astra: 64.5, baseline: 63.2 },
  { name: "HumanEval", full: "Code generation", astra: 91.8, baseline: 90.9 },
  { name: "SWE-bench Verified", full: "Agentic bug-fixing", astra: 61.7, baseline: 60.5 },
  { name: "LiveCodeBench", full: "Fresh competitive coding", astra: 63.9, baseline: 62.8 },
  { name: "MATH", full: "Competition mathematics", astra: 84.9, baseline: 83.8 },
  { name: "IFEval", full: "Instruction following", astra: 87.1, baseline: 86.2 },
];

/** Average lift over the baseline, for a headline number. */
export function averageLift(): number {
  const total = BENCHMARKS.reduce((a, b) => a + (b.astra - b.baseline), 0);
  return total / BENCHMARKS.length;
}
