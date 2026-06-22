import type { Metadata } from "next";
import { DocHeader, DocH2, DocP, DocPager } from "@/components/docs/doc-kit";
import { BenchmarkChart } from "@/components/docs/benchmark-chart";
import {
  BENCHMARKS,
  PRICING,
  blended,
  ASTRA_VERSION,
  OPUS_LABEL,
  OPENAI_LABEL,
  GEMINI_LABEL,
  astraLeads,
} from "@/lib/data/benchmarks";

export const metadata: Metadata = {
  title: "Astra Benchmarks · Documentation",
  description:
    "How Astra v1 performs against frontier models across reasoning and coding evaluations.",
};

function best(a: number, b: number, c: number, d: number) {
  const m = Math.max(a, b, c, d);
  return { a: a === m, b: b === m, c: c === m, d: d === m };
}

export default function BenchmarksPage() {
  return (
    <article>
      <DocHeader
        eyebrow="The model"
        title="Astra benchmarks"
        intro={`${ASTRA_VERSION} is Ren Labs' proprietary reasoning and coding model. Here's how it measures up against today's frontier models across standard evaluations — leading on competitive reasoning while costing a fraction as much to run.`}
      />

      <DocP>
        In Ren Labs&apos; internal evaluations, Astra v1 posts the top score on{" "}
        <strong>{astraLeads()} of {BENCHMARKS.length}</strong> benchmarks and stays
        within a point on the rest. Every row is a public benchmark; bars are
        accuracy / pass-rate percentages. See{" "}
        <a href="#methodology" className="text-bronze-deep underline-offset-2 hover:underline">
          methodology
        </a>{" "}
        for how these were run.
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
              <th className="hidden px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft md:table-cell">
                {OPENAI_LABEL}
              </th>
              <th className="hidden px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft lg:table-cell">
                {GEMINI_LABEL}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {BENCHMARKS.map((b) => {
              const w = best(b.astra, b.opus, b.openai, b.gemini);
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
                    className={`hidden px-4 py-3 text-right font-mono tnum md:table-cell ${
                      w.c ? "font-semibold text-ink" : "text-graphite"
                    }`}
                  >
                    {b.openai.toFixed(1)}
                  </td>
                  <td
                    className={`hidden px-4 py-3 text-right font-mono tnum lg:table-cell ${
                      w.d ? "font-semibold text-ink" : "text-graphite"
                    }`}
                  >
                    {b.gemini.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DocH2>Where Astra shines</DocH2>
      <DocP>
        Astra v1 leads on the benchmarks that reward precise, multi-step
        reasoning: LiveCodeBench (fresh competitive problems), AIME 2025, and
        MATH-500. That same rigor carries into real engineering work — on
        SWE-bench Verified and HumanEval it trades blows with the frontier,
        staying within roughly a point while costing a fraction as much to run.
      </DocP>

      <DocH2>Cost comparison</DocH2>
      <DocP>
        Performance is only half the story. Astra v1 is priced for teams shipping
        real products — the lowest blended cost of any frontier-class model. Its
        closest competitor on price is <strong>{GEMINI_LABEL}</strong>, and Astra
        still comes in under it while scoring higher across every reasoning and
        coding eval. Prices are per 1 million tokens; the blended figure assumes a
        typical 1:3 input-to-output mix.
      </DocP>

      <div className="my-8 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line bg-paper-deep/50 text-left">
              <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
                Model
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
                Input
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-soft">
                Output
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-bronze-deep">
                Blended / 1M
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...PRICING]
              .sort((a, b) => blended(a) - blended(b))
              .map((p) => {
                const isAstra = p.label === ASTRA_VERSION;
                const isClosest = p.label === GEMINI_LABEL;
                return (
                  <tr
                    key={p.label}
                    className={
                      isAstra
                        ? "bg-bronze-wash/30"
                        : isClosest
                          ? "bg-paper-deep/40"
                          : "hover:bg-paper-deep/30"
                    }
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          isAstra ? "text-bronze-deep" : isClosest ? "font-semibold text-ink" : "text-ink"
                        }`}
                      >
                        {p.label}
                      </span>
                      {p.note && (
                        <span className="ml-2 text-[12px] text-graphite-soft">{p.note}</span>
                      )}
                      {isClosest && (
                        <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[10.5px] font-medium text-graphite">
                          Closest competitor
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tnum ${isAstra ? "text-bronze-deep" : "text-graphite"}`}>
                      ${p.input.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tnum ${isAstra ? "text-bronze-deep" : "text-graphite"}`}>
                      ${p.output.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tnum ${
                        isAstra ? "font-semibold text-bronze-deep" : isClosest ? "font-semibold text-ink" : "text-ink"
                      }`}
                    >
                      ${blended(p).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <DocP>
        Frontier prices reflect standard pay-as-you-go API rates as of June 2026.
        Volume and enterprise tiers may differ. Astra v1 pricing is fixed and
        includes full API access for Ren Code and the Astra API.
      </DocP>

      <span id="methodology" className="block scroll-mt-28" />
      <DocH2>Methodology</DocH2>
      <DocP>
        These are Ren Labs&apos; internal evaluations. We run each public
        benchmark&apos;s full problem set through a single, fixed harness:
        deterministic decoding (temperature 0), one attempt per problem (pass@1),
        the benchmark&apos;s own official scoring script, and a standardized prompt
        applied identically to every model. No best-of-N, no majority voting, no
        cherry-picked subsets.
      </DocP>
      <DocP>
        Competitor figures are each vendor&apos;s published model-card numbers
        where available, and our own harness runs where not. Because providers
        report under different conditions, treat cross-model comparisons as
        directional rather than exact. We re-run the suite on every model release
        and update these tables when numbers move.
      </DocP>

      <DocPager href="/docs/benchmarks" />
    </article>
  );
}
