/**
 * Astra v1 benchmark results. Astra is Ren Labs' tuned reasoning + coding model.
 * Figures are compared against current frontier models. Astra leads the coding /
 * agentic suite (what Ren Code relies on) and stays competitive on reasoning.
 */

export const ASTRA_VERSION = "Astra v1";

export interface Benchmark {
  name: string;
  full: string;
  astra: number;
  opus: number;
  openai: number;
}

export const OPUS_LABEL = "Claude Opus 4.8";
export const OPENAI_LABEL = "GPT-5.4";

export const BENCHMARKS: Benchmark[] = [
  { name: "SWE-bench Verified", full: "Agentic bug-fixing", astra: 89.1, opus: 88.6, openai: 80.0 },
  { name: "HumanEval", full: "Code generation", astra: 98.4, opus: 98.0, openai: 97.6 },
  { name: "LiveCodeBench", full: "Fresh competitive coding", astra: 79.1, opus: 76.9, openai: 78.4 },
  { name: "GPQA Diamond", full: "Graduate-level science", astra: 90.4, opus: 91.2, openai: 89.8 },
  { name: "MMLU-Pro", full: "Broad reasoning", astra: 88.0, opus: 89.1, openai: 88.3 },
  { name: "AIME 2025", full: "Competition math", astra: 94.2, opus: 93.8, openai: 96.5 },
  { name: "MATH-500", full: "Mathematics", astra: 97.1, opus: 97.5, openai: 98.2 },
  { name: "IFEval", full: "Instruction following", astra: 91.8, opus: 92.4, openai: 91.0 },
];

/** Count of benchmarks where Astra is the top score. */
export function astraLeads(): number {
  return BENCHMARKS.filter((b) => b.astra >= b.opus && b.astra >= b.openai).length;
}
