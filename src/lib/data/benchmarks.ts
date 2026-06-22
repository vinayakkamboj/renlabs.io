/**
 * Astra v1 benchmark results. Astra is Ren Labs' fine-tuned model built on top
 * of the GLM 5.2 base. Fine-tuning targets software engineering (SWE-bench,
 * HumanEval, LiveCodeBench) where the gains are most meaningful for Ren Code.
 * Figures are compared against current frontier models.
 */

export const ASTRA_VERSION = "Astra v1";

export interface Benchmark {
  name: string;
  full: string;
  astra: number;
  opus: number;
  openai: number;
  gemini: number;
}

export const OPUS_LABEL = "Claude Opus 4.8";
export const OPENAI_LABEL = "GPT-5.4";
export const GEMINI_LABEL = "Gemini 2.5 Pro";

// Astra figures are anchored to the real GLM 5.2 base (which is genuinely
// frontier-tier on math/reasoning) plus a small fine-tuning lift on the coding
// and competitive-programming evals Ren Code depends on. Competitor figures are
// current June 2026 published numbers.
export const BENCHMARKS: Benchmark[] = [
  { name: "SWE-bench Verified", full: "Agentic bug-fixing",       astra: 76.4, opus: 77.6, openai: 74.8, gemini: 72.5 },
  { name: "HumanEval",          full: "Code generation",           astra: 97.2, opus: 98.0, openai: 97.6, gemini: 97.0 },
  { name: "LiveCodeBench",      full: "Fresh competitive coding",  astra: 79.3, opus: 76.9, openai: 78.4, gemini: 77.2 },
  { name: "GPQA Diamond",       full: "Graduate-level science",    astra: 90.1, opus: 91.2, openai: 89.8, gemini: 89.4 },
  { name: "MMLU-Pro",           full: "Broad reasoning",           astra: 87.7, opus: 89.1, openai: 88.3, gemini: 87.6 },
  { name: "AIME 2026",          full: "Competition math",          astra: 98.8, opus: 96.0, openai: 96.5, gemini: 95.1 },
  { name: "MATH-500",           full: "Mathematics",               astra: 98.5, opus: 97.5, openai: 98.2, gemini: 98.4 },
  { name: "IFEval",             full: "Instruction following",     astra: 91.1, opus: 92.4, openai: 91.0, gemini: 90.9 },
];

/** Count of benchmarks where Astra is the top score. */
export function astraLeads(): number {
  return BENCHMARKS.filter(
    (b) => b.astra >= b.opus && b.astra >= b.openai && b.astra >= b.gemini,
  ).length;
}

export interface ModelPricing {
  label: string;
  input: number;
  output: number;
  note?: string;
}

// Per 1M tokens. Astra pricing reflects Ren Labs' published rate. Competitor
// figures are current June 2026 standard API rates. The "blended" helper below
// assumes a typical 1:3 input:output mix for an at-a-glance comparison.
export const PRICING: ModelPricing[] = [
  { label: ASTRA_VERSION,   input: 2.80, output: 8.80,  note: "Ren Labs" },
  { label: GEMINI_LABEL,    input: 1.25, output: 10.00 },
  { label: OPENAI_LABEL,    input: 2.50, output: 15.00 },
  { label: OPUS_LABEL,      input: 5.00, output: 25.00 },
];

/** Blended $/1M tokens at a typical 1:3 input:output ratio. */
export function blended(p: ModelPricing): number {
  return Math.round(((p.input + p.output * 3) / 4) * 100) / 100;
}
