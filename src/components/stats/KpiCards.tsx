import { formatTokens } from "@/lib/format";
import type { DashboardKpis } from "@/lib/stats/queries";

type Props = {
  kpis: DashboardKpis;
};

type Card = {
  label: string;
  value: string;
  accent?: boolean;
};

export function KpiCards({ kpis }: Props) {
  const cards: Card[] = [
    {
      label: "Runs · last 7d",
      value: String(kpis.runsThisWeek),
      accent: true,
    },
    {
      label: "Tokens · this month",
      value:
        kpis.tokensThisMonth > 0 ? formatTokens(kpis.tokensThisMonth) : "—",
    },
    {
      label: "Tasks done",
      value: String(kpis.tasksDone),
    },
    {
      label: "Tasks open",
      value: String(kpis.tasksOpen),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="border border-hive-border bg-hive-panel p-3"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            {c.label}
          </div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              c.accent ? "text-hive-amber" : "text-hive-text"
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
