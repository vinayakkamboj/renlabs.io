"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BENCHMARKS,
  ASTRA_VERSION,
  OPUS_LABEL,
  OPENAI_LABEL,
  GEMINI_LABEL,
} from "@/lib/data/benchmarks";

const data = BENCHMARKS.map((b) => ({
  name: b.name,
  [ASTRA_VERSION]: b.astra,
  [OPUS_LABEL]: b.opus,
  [OPENAI_LABEL]: b.openai,
  [GEMINI_LABEL]: b.gemini,
}));

const COLORS = {
  astra:  "#8a6f45", // bronze — Astra
  opus:   "#413f39", // ink-soft
  openai: "#b3a892", // stone
  gemini: "#6b8a9a", // slate-blue
};

export function BenchmarkChart() {
  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 28, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e0d2" vertical={false} />
          <XAxis
            dataKey="name"
            angle={-30}
            textAnchor="end"
            height={70}
            interval={0}
            tick={{ fill: "#6f6a5f", fontSize: 11 }}
            stroke="#d6cfbd"
          />
          <YAxis
            domain={[60, 100]}
            tick={{ fill: "#6f6a5f", fontSize: 11 }}
            stroke="#d6cfbd"
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            cursor={{ fill: "rgba(138,111,69,0.06)" }}
            contentStyle={{
              background: "#fffdf9",
              border: "1px solid #e6e0d2",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value) => `${value}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey={ASTRA_VERSION} fill={COLORS.astra}  radius={[3, 3, 0, 0]} />
          <Bar dataKey={OPUS_LABEL}    fill={COLORS.opus}   radius={[3, 3, 0, 0]} />
          <Bar dataKey={OPENAI_LABEL}  fill={COLORS.openai} radius={[3, 3, 0, 0]} />
          <Bar dataKey={GEMINI_LABEL}  fill={COLORS.gemini} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
