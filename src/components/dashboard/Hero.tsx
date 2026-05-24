import "server-only";

import { HeroFirstRunActions } from "@/components/dashboard/HeroFirstRunActions";
import { HexIcon } from "@/components/icons/HexIcon";
import { formatTokens } from "@/lib/format";
import { getUserName } from "@/lib/settings";

type Props = {
  firstRun: boolean;
  projectsCount: number;
  runningCount: number;
  needsInputCount: number;
  blockedCount: number;
  tokensThisMonth: number;
  userName?: string;
};

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Hero({
  firstRun,
  projectsCount,
  runningCount,
  needsInputCount,
  blockedCount,
  tokensThisMonth,
  userName,
}: Props) {
  const resolvedName = userName ?? getUserName();
  // First-run hero replaces the normal greeting until the user adds a project.
  // After that, even with onboarding still pending, the dense pill row is more
  // useful (and less in-the-way).
  if (firstRun && projectsCount === 0) {
    return (
      <section className="border border-hive-amber/40 bg-hive-panel p-8">
        <div className="flex items-start gap-4">
          <div className="text-hive-amber">
            <HexIcon size={36} strokeWidth={1.25} />
          </div>
          <div className="min-w-0">
            <h1 className="font-sans text-2xl text-hive-text">
              Welcome to Hive
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-hive-muted">
              Hive is your command center for every AI coding project running in
              parallel. Add a project, queue tasks on the Kanban board, and let
              agents run while you watch the live feed. Start with one of the
              shortcuts below.
            </p>
          </div>
        </div>
        <HeroFirstRunActions />
      </section>
    );
  }

  const attention = needsInputCount + blockedCount;

  return (
    <section className="border border-hive-border bg-hive-panel p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-sans text-2xl text-hive-text">
            {greeting(new Date().getHours())},{" "}
            <span className="text-hive-amber">{resolvedName}</span>
          </h1>
          <p className="mt-1 text-sm text-hive-muted">
            Here&apos;s what the swarm is up to.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
          <span className="border border-hive-border px-2 py-1 text-hive-text/80">
            {projectsCount} project{projectsCount === 1 ? "" : "s"}
          </span>
          <span
            className={`border px-2 py-1 ${
              runningCount > 0
                ? "border-hive-amber/60 text-hive-amber"
                : "border-hive-border text-hive-muted"
            }`}
          >
            {runningCount} running
          </span>
          <span
            className={`border px-2 py-1 ${
              attention > 0
                ? "border-hive-red/60 text-hive-red"
                : "border-hive-border text-hive-muted"
            }`}
          >
            {attention} need attention
          </span>
          <span className="border border-hive-border px-2 py-1 text-hive-cyan">
            {tokensThisMonth > 0 ? `${formatTokens(tokensThisMonth)} tokens` : "no tokens"} this month
          </span>
        </div>
      </div>
    </section>
  );
}
