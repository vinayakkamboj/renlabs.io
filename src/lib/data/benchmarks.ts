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

export const BENCHMARKS: Benchmark[] = [
  { name: "SWE-bench Verified", full: "Agentic bug-fixing",       astra: 89.1, opus: 88.6, openai: 80.0, gemini: 75.2 },
  { name: "HumanEval",          full: "Code generation",           astra: 98.4, opus: 98.0, openai: 97.6, gemini: 97.0 },
  { name: "LiveCodeBench",      full: "Fresh competitive coding",  astra: 79.1, opus: 76.9, openai: 78.4, gemini: 77.2 },
  { name: "GPQA Diamond",       full: "Graduate-level science",    astra: 90.4, opus: 91.2, openai: 89.8, gemini: 89.4 },
  { name: "MMLU-Pro",           full: "Broad reasoning",           astra: 88.0, opus: 89.1, openai: 88.3, gemini: 87.6 },
  { name: "AIME 2025",          full: "Competition math",          astra: 94.2, opus: 93.8, openai: 96.5, gemini: 95.1 },
  { name: "MATH-500",           full: "Mathematics",               astra: 97.1, opus: 97.5, openai: 98.2, gemini: 98.4 },
  { name: "IFEval",             full: "Instruction following",     astra: 91.8, opus: 92.4, openai: 91.0, gemini: 90.9 },
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

export const PRICING: ModelPricing[] = [
  { label: ASTRA_VERSION,   input: 0.25,  output: 0.80,  note: "Ren Labs" },
  { label: GEMINI_LABEL,    input: 3.50,  output: 10.50 },
  { label: OPENAI_LABEL,    input: 12.00, output: 36.00 },
  { label: OPUS_LABEL,      input: 15.00, output: 75.00 },
];
