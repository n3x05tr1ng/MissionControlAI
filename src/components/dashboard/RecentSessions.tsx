import "server-only";

import Link from "next/link";

import type { SessionRow } from "@/lib/contracts";
import { formatTokensOrDash } from "@/lib/format";
import { formatRelative } from "@/lib/time";

export type EnrichedSession = SessionRow & {
  projectName: string;
  profileName: string | null;
};

type Props = {
  sessions: EnrichedSession[];
};

function durationLabel(s: SessionRow): string {
  if (!s.ended_at) return "—";
  const ms = Date.parse(s.ended_at) - Date.parse(s.started_at);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r === 0 ? `${m}m` : `${m}m${r}s`;
}

function ResultBadge({ result }: { result: SessionRow["result"] }) {
  const cls =
    result === "success"
      ? "bg-success-soft text-success"
      : result === "error"
        ? "bg-destructive-soft text-destructive"
        : "bg-primary-soft text-primary";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] ${cls}`}
    >
      {result === "running" ? (
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
          aria-hidden="true"
        />
      ) : null}
      {result}
    </span>
  );
}

export function RecentSessions({ sessions }: Props) {
  return (
    <section className="hive-card animate-enter overflow-hidden">
      <header className="border-b border-border px-4 py-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground">
          Recent sessions
        </h3>
      </header>
      {sessions.length === 0 ? (
        <div className="p-4">
          <p className="text-[13px] text-muted-foreground">
            No sessions yet — kick off a run from any project.
          </p>
        </div>
      ) : (
        <ul className="stagger-children divide-y divide-border">
          {sessions.map((s) => {
            const tokens =
              (s.tokens_input ?? 0) + (s.tokens_output ?? 0);
            return (
              <li
                key={s.id}
                className="px-4 py-2.5 hover:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/projects/${s.project_id}?tab=sessions`}
                    className="truncate text-[13px] font-medium text-foreground hover:text-primary"
                  >
                    {s.projectName}
                  </Link>
                  <ResultBadge result={s.result} />
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-[11px] text-faint">
                  <span className="truncate">
                    {s.profileName ?? "no profile"} ·{" "}
                    {formatRelative(s.started_at)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {durationLabel(s)}
                    {tokens > 0 ? (
                      <span className="ml-2 text-info">
                        {formatTokensOrDash(tokens)} tok
                      </span>
                    ) : (
                      <span className="ml-2">—</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
