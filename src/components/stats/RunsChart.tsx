"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
  useChartTokens,
} from "@/components/stats/useChartTokens";
import { formatTokens } from "@/lib/format";

type Point = { date: string; runs: number; tokens: number };

type Props = {
  data: Point[];
  /** Skip the card frame when a parent panel already provides one. */
  frameless?: boolean;
};

function shortDate(iso: string): string {
  // YYYY-MM-DD → MM-DD
  return iso.length === 10 ? iso.slice(5) : iso;
}

export function RunsChart({ data, frameless = false }: Props) {
  const tokens = useChartTokens();
  const totalRuns = data.reduce((acc, d) => acc + d.runs, 0);
  const frame = frameless ? "" : "hive-card ";

  if (totalRuns === 0) {
    return (
      <div
        className={`${frame}flex h-[220px] items-center justify-center p-4`}
      >
        <p className="max-w-[28ch] text-center text-[13px] text-muted-foreground">
          No runs yet — kick off a task to see activity here.
        </p>
      </div>
    );
  }

  return (
    <div className={`${frame}h-[220px] p-2`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient id="runsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.4} />
              <stop offset="100%" stopColor={tokens.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke={tokens.faint}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="runs"
            stroke={tokens.faint}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="tokens"
            orientation="right"
            stroke={tokens.faint}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatTokens(v)}
          />
          <Tooltip
            contentStyle={chartTooltipContentStyle}
            labelStyle={chartTooltipLabelStyle}
            cursor={{ stroke: tokens.border }}
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value ?? 0);
              return name === "tokens"
                ? [formatTokens(n), "tokens"]
                : [String(n), "runs"];
            }}
          />
          <Area
            yAxisId="runs"
            type="monotone"
            dataKey="runs"
            stroke={tokens.primary}
            strokeWidth={2}
            fill="url(#runsFill)"
          />
          <Line
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            stroke={tokens.info}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
