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
    <div className="stagger-children grid h-full grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="hive-card flex flex-col justify-between gap-2 p-4"
        >
          <div className="text-[11px] font-medium text-faint">{c.label}</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              c.accent ? "text-primary" : "text-foreground"
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
