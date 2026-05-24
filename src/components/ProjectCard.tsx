import Link from "next/link";

import { ProjectCardActions } from "@/components/ProjectCardActions";
import { StatusBadge } from "@/components/StatusBadge";
import type { ProjectSnapshot } from "@/lib/contracts";
import { formatTokensOrDash } from "@/lib/format";
import { formatRelative } from "@/lib/time";

type Props = {
  snapshot: ProjectSnapshot;
  // Optional task counts. When omitted (legacy callers), the stats row is
  // hidden so existing usages keep their original layout.
  taskCounts?: { open: number; running: number };
};

export function ProjectCard({ snapshot, taskCounts }: Props) {
  const { config, state, git } = snapshot;
  const lastRunAt = state.lastSession?.endedAt ?? null;
  const lastTokens = state.lastSession
    ? (state.lastSession.tokens?.input ?? 0) +
      (state.lastSession.tokens?.output ?? 0)
    : 0;
  const nextStep = state.nextStep?.trim() || "—";
  const showStats =
    !!taskCounts && (taskCounts.open > 0 || taskCounts.running > 0 || !!git);

  return (
    <div className="relative">
      <Link
        href={`/projects/${config.id}`}
        className="group block border border-hive-border bg-hive-panel p-4 transition-colors hover:border-hive-amber/60"
      >
        <header className="flex items-start justify-between gap-3 pr-10">
          <h2 className="text-base font-semibold text-hive-text group-hover:text-hive-amber transition-colors">
            {config.name}
          </h2>
          <StatusBadge status={state.status} />
        </header>

        {config.description ? (
          <p className="mt-1 text-xs text-hive-muted line-clamp-1">
            {config.description}
          </p>
        ) : null}

        <div className="mt-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ NEXT ]
          </span>
          <p className="mt-1 text-sm text-hive-text/90 line-clamp-2">
            {nextStep}
          </p>
        </div>

        {showStats ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
            {taskCounts && taskCounts.open > 0 ? (
              <span className="border border-hive-border px-1.5 py-0.5 text-hive-text/80">
                {taskCounts.open} open
              </span>
            ) : null}
            {taskCounts && taskCounts.running > 0 ? (
              <span className="border border-hive-amber/50 px-1.5 py-0.5 text-hive-amber">
                {taskCounts.running} running
              </span>
            ) : null}
            {git ? (
              <span
                className={`border px-1.5 py-0.5 ${
                  git.dirty
                    ? "border-hive-amber/40 text-hive-amber"
                    : "border-hive-green/40 text-hive-green"
                }`}
              >
                {git.dirty ? "dirty" : "clean"}
              </span>
            ) : null}
          </div>
        ) : null}

        <footer className="mt-4 flex items-center justify-between gap-2 font-mono text-[11px] text-hive-muted">
          <span>
            {lastRunAt ? `ran ${formatRelative(lastRunAt)}` : "never run"}
            {lastRunAt ? (
              <span className="ml-2 text-hive-text/60">
                {lastTokens > 0
                  ? `${formatTokensOrDash(lastTokens)} tok`
                  : "—"}
              </span>
            ) : null}
          </span>
          {git ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  git.dirty ? "bg-hive-amber" : "bg-hive-green"
                }`}
                aria-label={git.dirty ? "dirty" : "clean"}
              />
              <code className="text-hive-text/70">{git.branch || "(detached)"}</code>
            </span>
          ) : (
            <span>no git</span>
          )}
        </footer>
      </Link>
      <ProjectCardActions project={config} />
    </div>
  );
}
