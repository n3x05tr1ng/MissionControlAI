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
    <section className="border border-hive-border bg-hive-panel">
      <header className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ USAGE ]
        </h2>
        {stats.lastRunAt ? (
          <span className="font-mono text-[10px] text-hive-muted">
            last run · {stats.lastRunAt.slice(0, 10)}
          </span>
        ) : null}
      </header>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-hive-border p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              {c.label}
            </div>
            <div
              className={`mt-2 text-xl font-semibold ${
                c.accent ? "text-hive-amber" : "text-hive-text"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-hive-border p-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Runs · last 14d
        </div>
        <Sparkline data={stats.runsLast14} />
      </div>
    </section>
  );
}
