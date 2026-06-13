import type { SessionRow } from "@/lib/contracts";
import { formatTokensOrDash } from "@/lib/format";
import { formatRelative } from "@/lib/time";

type Props = {
  sessions: SessionRow[];
};

const RESULT_CLASS: Record<string, string> = {
  success: "text-success",
  error: "text-destructive",
  running: "text-primary",
};

export function SessionTimeline({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 p-4 shadow-bevel">
        <p className="text-sm text-muted-foreground">No sessions yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel">
      <ul className="divide-y divide-border">
        {sessions.map((s) => {
          const when = s.ended_at ?? s.started_at;
          const resultClass = RESULT_CLASS[s.result] ?? "text-muted-foreground";
          const tokensIn = s.tokens_input ?? 0;
          const tokensOut = s.tokens_output ?? 0;
          const total = tokensIn + tokensOut;
          return (
            <li
              key={s.id}
              className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 font-mono text-xs transition-colors hover:bg-surface-2"
            >
              <span className="w-24 shrink-0 text-faint">
                {formatRelative(when)}
              </span>
              <span className={`font-medium ${resultClass}`}>{s.result}</span>
              <span className="text-foreground/80">{s.model}</span>
              <span className="tabular-nums text-muted-foreground">
                {total > 0 ? `${formatTokensOrDash(total)} tok` : "—"}
              </span>
              <span className="tabular-nums text-faint">
                {tokensIn}/{tokensOut}
              </span>
              <span className="ml-auto max-w-[160px] truncate text-faint">
                {s.id}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
