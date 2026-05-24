import type { SessionRow } from "@/lib/contracts";
import { formatTokensOrDash } from "@/lib/format";
import { formatRelative } from "@/lib/time";

type Props = {
  sessions: SessionRow[];
};

const RESULT_CLASS: Record<string, string> = {
  success: "text-hive-green",
  error: "text-hive-red",
  running: "text-hive-amber",
};

export function SessionTimeline({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="border border-hive-border bg-hive-panel p-4">
        <p className="text-sm text-hive-muted">No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="border border-hive-border bg-hive-panel">
      <ul className="divide-y divide-hive-border">
        {sessions.map((s) => {
          const when = s.ended_at ?? s.started_at;
          const resultClass = RESULT_CLASS[s.result] ?? "text-hive-muted";
          const tokensIn = s.tokens_input ?? 0;
          const tokensOut = s.tokens_output ?? 0;
          const total = tokensIn + tokensOut;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 font-mono text-xs"
            >
              <span className="text-hive-muted w-24 shrink-0">
                {formatRelative(when)}
              </span>
              <span className={`uppercase ${resultClass}`}>{s.result}</span>
              <span className="text-hive-text/80">{s.model}</span>
              <span className="text-hive-muted">
                {total > 0 ? `${formatTokensOrDash(total)} tok` : "—"}
              </span>
              <span className="text-hive-muted">
                {tokensIn}/{tokensOut}
              </span>
              <span className="ml-auto text-hive-muted truncate max-w-[160px]">
                {s.id}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
