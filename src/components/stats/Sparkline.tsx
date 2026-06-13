"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
  useChartTokens,
} from "@/components/stats/useChartTokens";

type Point = { date: string; runs: number };

type Props = {
  data: Point[];
  height?: number;
};

export function Sparkline({ data, height = 60 }: Props) {
  const tokens = useChartTokens();
  const total = data.reduce((acc, d) => acc + d.runs, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-faint"
        style={{ height }}
      >
        no runs
      </div>
    );
  }
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.5} />
              <stop offset="100%" stopColor={tokens.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              ...chartTooltipContentStyle,
              fontSize: 11,
              padding: "2px 8px",
            }}
            labelStyle={chartTooltipLabelStyle}
            formatter={(value) => [
              String(typeof value === "number" ? value : (value ?? 0)),
              "runs",
            ]}
          />
          <Area
            type="monotone"
            dataKey="runs"
            stroke={tokens.primary}
            strokeWidth={1.5}
            fill="url(#sparkFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
