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
      ? "text-hive-green border-hive-green/40"
      : result === "error"
        ? "text-hive-red border-hive-red/40"
        : "text-hive-amber border-hive-amber/40";
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}
    >
      {result}
    </span>
  );
}

export function RecentSessions({ sessions }: Props) {
  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ RECENT SESSIONS ]
        </h3>
      </header>
      {sessions.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-hive-muted">
            No sessions yet — kick off a run from any project.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hive-border">
          {sessions.map((s) => {
            const tokens =
              (s.tokens_input ?? 0) + (s.tokens_output ?? 0);
            return (
              <li key={s.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/projects/${s.project_id}?tab=sessions`}
                    className="truncate text-sm text-hive-text hover:text-hive-amber"
                  >
                    {s.projectName}
                  </Link>
                  <ResultBadge result={s.result} />
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-[11px] text-hive-muted">
                  <span className="truncate">
                    {s.profileName ?? "no profile"} ·{" "}
                    {formatRelative(s.started_at)}
                  </span>
                  <span className="shrink-0">
                    {durationLabel(s)}
                    {tokens > 0 ? (
                      <span className="ml-2 text-hive-cyan">
                        {formatTokensOrDash(tokens)} tok
                      </span>
                    ) : (
                      <span className="ml-2 text-hive-muted/80">—</span>
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
