"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Point = { date: string; runs: number };

type Props = {
  data: Point[];
  height?: number;
};

const AMBER = "#FFB000";
const PANEL = "#13161a";
const BORDER = "#23282e";
const TEXT = "#e6e6e6";
const MUTED = "#7a8088";

export function Sparkline({ data, height = 60 }: Props) {
  const total = data.reduce((acc, d) => acc + d.runs, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-hive-muted"
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
              <stop offset="0%" stopColor={AMBER} stopOpacity={0.55} />
              <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 0,
              color: TEXT,
              fontSize: 11,
              padding: "2px 6px",
            }}
            labelStyle={{ color: MUTED, fontFamily: "monospace" }}
            formatter={(value) => [
              String(typeof value === "number" ? value : (value ?? 0)),
              "runs",
            ]}
          />
          <Area
            type="monotone"
            dataKey="runs"
            stroke={AMBER}
            strokeWidth={1.5}
            fill="url(#sparkFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
