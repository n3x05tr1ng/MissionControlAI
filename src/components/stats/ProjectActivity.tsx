import { RunsChart } from "@/components/stats/RunsChart";
import { formatTokensOrDash } from "@/lib/format";
import { projectActivity } from "@/lib/stats/queries";

type Props = {
  projectId: string;
  days?: number;
};

export function ProjectActivity({ projectId, days = 14 }: Props) {
  const data = projectActivity(projectId, days);
  const totalRuns = data.reduce((acc, d) => acc + d.runs, 0);
  const totalTokens = data.reduce((acc, d) => acc + d.tokens, 0);

  return (
    <section className="hive-card animate-enter overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[12px] font-medium text-muted-foreground">
          Activity · last {days}d
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-faint">
          {totalRuns} runs ·{" "}
          {totalTokens > 0
            ? `${formatTokensOrDash(totalTokens)} tok`
            : "—"}
        </span>
      </header>
      <div className="p-3">
        <RunsChart data={data} frameless />
      </div>
    </section>
  );
}
