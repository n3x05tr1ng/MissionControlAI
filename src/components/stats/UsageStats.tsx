import { Sparkline } from "@/components/stats/Sparkline";
import { formatTokensOrDash } from "@/lib/format";
import type { ProfileUsage } from "@/lib/stats/queries";

type Props = {
  stats: ProfileUsage;
};

function fmtPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function UsageStats({ stats }: Props) {
  const cards = [
    { label: "Runs", value: String(stats.runs), accent: true },
    { label: "Tokens", value: formatTokensOrDash(stats.tokens) },
    {
      label: "Success",
      value: stats.runs > 0 ? fmtPercent(stats.successRate) : "—",
    },
    { label: "Avg duration", value: fmtDuration(stats.avgDurationSeconds) },
  ];

  return (
    <section className="hive-card animate-enter overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[12px] font-medium text-muted-foreground">
          Usage
        </h2>
        {stats.lastRunAt ? (
          <span className="font-mono text-[11px] text-faint">
            last run · {stats.lastRunAt.slice(0, 10)}
          </span>
        ) : null}
      </header>
      <div className="stagger-children grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-md border border-border bg-surface-2 p-3"
          >
            <div className="text-[11px] font-medium text-faint">
              {c.label}
            </div>
            <div
              className={`mt-2 text-xl font-semibold tabular-nums ${
                c.accent ? "text-primary" : "text-foreground"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 text-[11px] font-medium text-faint">
          Runs · last 14d
        </div>
        <Sparkline data={stats.runsLast14} />
      </div>
    </section>
  );
}
