import type { Metadata } from "next";
import { DocHeader, DocH2, DocP, DocPager } from "@/components/docs/doc-kit";
import { BENCHMARKS, ASTRA_VERSION, averageLift } from "@/lib/data/benchmarks";

export const metadata: Metadata = {
  title: "Astra Benchmarks · Documentation",
  description: "How Astra v1 performs across standard reasoning and coding evaluations.",
};

export default function BenchmarksPage() {
  const lift = averageLift();
  return (
    <article>
      <DocHeader
        eyebrow="The model"
        title="Astra benchmarks"
        intro={`${ASTRA_VERSION} is Ren Labs' tuned reasoning and coding model. Below are its scores across widely used evaluations, with a leading open baseline for context — Astra edges ahead across the board.`}
      />

      <DocP>
        Every figure is a standard public benchmark, run with the same harness for
        both models. Astra v1 averages{" "}
        <strong>+{lift.toFixed(1)} points</strong> over the baseline.
      </DocP>

      <div className="my-8 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line bg-paper-deep/50 text-left">
              <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
                Benchmark
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-bronze-deep">
                {ASTRA_VERSION}
              </th>
              <th className="hidden px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft sm:table-cell">
                Open baseline
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
                Δ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {BENCHMARKS.map((b) => (
              <tr key={b.name} className="hover:bg-paper-deep/30">
                <td className="px-4 py-3">
                  <span className="font-medium text-ink">{b.name}</span>
                  <span className="ml-2 text-[12.5px] text-graphite-soft">
                    {b.full}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-bronze-deep tnum">
                  {b.astra.toFixed(1)}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-graphite tnum sm:table-cell">
                  {b.baseline.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[13px] text-bronze tnum">
                  +{(b.astra - b.baseline).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocH2>How to read these</DocH2>
      <DocP>
        Scores are accuracy/pass-rate percentages on each benchmark&apos;s public
        test set. Reasoning benchmarks (MMLU-Pro, GPQA) probe multi-step problem
        solving; coding benchmarks (HumanEval, SWE-bench Verified, LiveCodeBench)
        measure real program synthesis and agentic bug-fixing, which is what Ren
        Code relies on day to day.
      </DocP>

      <DocH2>Methodology</DocH2>
      <DocP>
        Astra v1 is fine-tuned and aligned by Ren Labs on top of a strong open
        foundation, then evaluated with the same prompts, decoding settings, and
        scoring scripts as the baseline. We publish the numbers as run — no
        cherry-picked subsets, no best-of-N inflation.
      </DocP>

      <DocPager href="/docs/benchmarks" />
    </article>
  );
}
