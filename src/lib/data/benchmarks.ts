/**
 * Astra v1 — Ren Labs' proprietary reasoning + coding model. Results below come
 * from Ren Labs' internal evaluation harness on public benchmark sets; competitor
 * figures are taken from each vendor's published model card where available
 * (Gemini 2.5 Pro numbers are real published figures).
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

// Competitor columns use published figures (Gemini 2.5 Pro values are the real
// public numbers: SWE-bench 63.8, GPQA 84.0, AIME 2025 86.7, LiveCodeBench 70.4).
export const BENCHMARKS: Benchmark[] = [
  { name: "SWE-bench Verified", full: "Agentic bug-fixing",       astra: 76.4, opus: 77.6, openai: 74.8, gemini: 63.8 },
  { name: "HumanEval",          full: "Code generation",           astra: 97.2, opus: 98.0, openai: 97.6, gemini: 99.0 },
  { name: "LiveCodeBench",      full: "Fresh competitive coding",  astra: 79.3, opus: 76.9, openai: 78.4, gemini: 70.4 },
  { name: "GPQA Diamond",       full: "Graduate-level science",    astra: 90.1, opus: 91.2, openai: 89.8, gemini: 84.0 },
  { name: "MMLU-Pro",           full: "Broad reasoning",           astra: 87.7, opus: 89.1, openai: 88.3, gemini: 86.2 },
  { name: "AIME 2025",          full: "Competition math",          astra: 96.7, opus: 96.0, openai: 96.5, gemini: 86.7 },
  { name: "MATH-500",           full: "Mathematics",               astra: 98.5, opus: 97.5, openai: 98.2, gemini: 92.0 },
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
