import type { Metadata } from "next";
import { DocHeader, DocH2, DocP, DocPager } from "@/components/docs/doc-kit";
import { BenchmarkChart } from "@/components/docs/benchmark-chart";
import {
  BENCHMARKS,
  ASTRA_VERSION,
  OPUS_LABEL,
  OPENAI_LABEL,
  astraLeads,
} from "@/lib/data/benchmarks";

export const metadata: Metadata = {
  title: "Astra Benchmarks · Documentation",
  description:
    "How Astra v1 performs against frontier models across reasoning and coding evaluations.",
};

function best(a: number, b: number, c: number) {
  const m = Math.max(a, b, c);
  return { a: a === m, b: b === m, c: c === m };
}

export default function BenchmarksPage() {
  return (
    <article>
      <DocHeader
        eyebrow="The model"
        title="Astra benchmarks"
        intro={`${ASTRA_VERSION} is Ren Labs' tuned reasoning and coding model. Here's how it measures up against today's frontier models across standard evaluations — leading the coding and agentic suite that Ren Code is built on.`}
      />

      <DocP>
        Astra v1 posts the top score on <strong>{astraLeads()} of {BENCHMARKS.length}</strong>{" "}
        benchmarks, and stays within a point on the rest. Every figure is a public
        benchmark; bars are accuracy / pass-rate percentages.
      </DocP>

      <div className="my-8 rounded-2xl border border-line bg-paper-raised p-5">
        <BenchmarkChart />
      </div>

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
                {OPUS_LABEL}
              </th>
              <th className="hidden px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft sm:table-cell">
                {OPENAI_LABEL}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {BENCHMARKS.map((b) => {
              const w = best(b.astra, b.opus, b.openai);
              return (
                <tr key={b.name} className="hover:bg-paper-deep/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{b.name}</span>
                    <span className="ml-2 text-[12.5px] text-graphite-soft">
                      {b.full}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tnum ${
                      w.a ? "font-semibold text-bronze-deep" : "text-bronze-deep/80"
                    }`}
                  >
                    {b.astra.toFixed(1)}
                  </td>
                  <td
                    className={`hidden px-4 py-3 text-right font-mono tnum sm:table-cell ${
                      w.b ? "font-semibold text-ink" : "text-graphite"
                    }`}
                  >
                    {b.opus.toFixed(1)}
                  </td>
                  <td
                    className={`hidden px-4 py-3 text-right font-mono tnum sm:table-cell ${
                      w.c ? "font-semibold text-ink" : "text-graphite"
                    }`}
                  >
                    {b.openai.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DocH2>Where Astra shines</DocH2>
      <DocP>
        Astra v1 is tuned for software engineering, so it leads on the benchmarks
        that mirror real work: SWE-bench Verified (fixing real GitHub issues),
        HumanEval (writing correct code), and LiveCodeBench (fresh competitive
        problems). On broad reasoning and math it trades blows with the frontier,
        staying within roughly a point.
      </DocP>

      <DocH2>Methodology</DocH2>
      <DocP>
        Astra v1 is fine-tuned and aligned by Ren Labs on top of a strong
        open foundation, then evaluated with the same prompts, decoding settings,
        and scoring scripts used for the comparison models. We publish numbers as
        run — no cherry-picked subsets, no best-of-N inflation.
      </DocP>

      <DocPager href="/docs/benchmarks" />
    </article>
  );
}
