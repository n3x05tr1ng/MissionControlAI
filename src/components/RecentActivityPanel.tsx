import type { NotificationRow, NotificationType } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  notifications: NotificationRow[];
};

const DOT_CLASS: Record<NotificationType, string> = {
  "run-complete": "bg-primary",
  reminder: "bg-info",
  nudge: "bg-warning",
};

export function RecentActivityPanel({ notifications }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel">
      <header className="border-b border-border px-4 py-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground">
          Recent activity
        </h3>
      </header>
      {notifications.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="min-h-11 px-4 py-2.5 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    DOT_CLASS[n.type] ?? "bg-faint"
                  }`}
                  aria-label={n.type}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm text-foreground">{n.title}</p>
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
