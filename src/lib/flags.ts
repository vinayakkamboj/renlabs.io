/**
 * Marketing / positioning feature flags.
 *
 * Ren Labs is positioned as an AI Workspace Platform — users create projects
 * and deploy AI agents to work on them. The model (Astra) is infrastructure,
 * not the hero of the product.
 *
 * The benchmark and model-marketing sections are intentionally NOT deleted —
 * they're kept in the codebase but gated OFF by default. Because the homepage
 * is a server component, a disabled flag means the section is never rendered
 * into the HTML at all (not just hidden with CSS), so it isn't present in
 * browser-inspectable content. Flip the env var to bring them back.
 *
 *   NEXT_PUBLIC_SHOW_BENCHMARKS=1       → show benchmark stat section
 *   NEXT_PUBLIC_SHOW_MODEL_MARKETING=1  → show the Astra flagship-model section
 */

function enabled(...values: (string | undefined)[]): boolean {
  return values.some((v) => v === "1" || v === "true");
}

/** Benchmark numbers / model comparisons on the marketing site. Off by default. */
export function showBenchmarks(): boolean {
  return enabled(
    process.env.NEXT_PUBLIC_SHOW_BENCHMARKS,
    process.env.SHOW_BENCHMARKS,
  );
}

/** The "Astra — flagship model" hero section. Off by default. */
export function showModelMarketing(): boolean {
  return enabled(
    process.env.NEXT_PUBLIC_SHOW_MODEL_MARKETING,
    process.env.SHOW_MODEL_MARKETING,
  );
}
