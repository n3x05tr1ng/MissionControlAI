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

import { formatTokens } from "@/lib/format";

type Point = { date: string; runs: number; tokens: number };

type Props = {
  data: Point[];
};

const AMBER = "#FFB000";
const CYAN = "#5cc8ff";
const PANEL = "#13161a";
const BORDER = "#23282e";
const TEXT = "#e6e6e6";
const MUTED = "#7a8088";

function shortDate(iso: string): string {
  // YYYY-MM-DD → MM-DD
  return iso.length === 10 ? iso.slice(5) : iso;
}

export function RunsChart({ data }: Props) {
  const totalRuns = data.reduce((acc, d) => acc + d.runs, 0);

  if (totalRuns === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center border border-hive-border bg-hive-panel p-4">
        <p className="text-sm text-hive-muted">
          No runs yet — kick off a task to see activity here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[220px] border border-hive-border bg-hive-panel p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient id="runsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.45} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke={MUTED}
            fontSize={10}
            tickLine={false}
          />
          <YAxis
            yAxisId="runs"
            stroke={MUTED}
            fontSize={10}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="tokens"
            orientation="right"
            stroke={MUTED}
            fontSize={10}
            tickLine={false}
            tickFormatter={(v: number) => formatTokens(v)}
          />
          <Tooltip
            contentStyle={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 0,
              color: TEXT,
              fontSize: 12,
            }}
            labelStyle={{ color: MUTED, fontFamily: "monospace" }}
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
            stroke={AMBER}
            strokeWidth={2}
            fill="url(#runsFill)"
          />
          <Line
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            stroke={CYAN}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
