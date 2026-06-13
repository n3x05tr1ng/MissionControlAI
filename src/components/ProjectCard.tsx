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
    <div className="relative h-full">
      <Link
        href={`/projects/${config.id}`}
        className="hive-card group flex h-full flex-col p-4 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_0_32px_-16px_var(--primary)]"
      >
        <header className="flex items-start justify-between gap-3 pr-10">
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
            {config.name}
          </h3>
          <StatusBadge status={state.status} />
        </header>

        {config.description ? (
          <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
            {config.description}
          </p>
        ) : null}

        <div className="mt-3">
          <span className="text-[11px] font-medium text-faint">Next up</span>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-foreground/90">
            {nextStep}
          </p>
        </div>

        {showStats ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {taskCounts && taskCounts.open > 0 ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {taskCounts.open} open
              </span>
            ) : null}
            {taskCounts && taskCounts.running > 0 ? (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary">
                {taskCounts.running} running
              </span>
            ) : null}
            {git ? (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
                  git.dirty
                    ? "bg-warning-soft text-warning"
                    : "bg-success-soft text-success"
                }`}
              >
                {git.dirty ? "dirty" : "clean"}
              </span>
            ) : null}
          </div>
        ) : null}

        <footer className="mt-auto flex items-center justify-between gap-2 pt-4 font-mono text-[11px] text-faint">
          <span className="truncate">
            {lastRunAt ? `ran ${formatRelative(lastRunAt)}` : "never run"}
            {lastRunAt ? (
              <span className="ml-2 text-muted-foreground">
                {lastTokens > 0
                  ? `${formatTokensOrDash(lastTokens)} tok`
                  : "—"}
              </span>
            ) : null}
          </span>
          {git ? (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  git.dirty ? "bg-warning" : "bg-success"
                }`}
                aria-label={git.dirty ? "dirty" : "clean"}
              />
              <code className="text-muted-foreground">
                {git.branch || "(detached)"}
              </code>
            </span>
          ) : (
            <span className="shrink-0">no git</span>
          )}
        </footer>
      </Link>
      <ProjectCardActions project={config} />
    </div>
  );
}
