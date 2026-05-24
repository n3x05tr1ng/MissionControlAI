import type { NotificationRow, NotificationType } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  notifications: NotificationRow[];
};

const DOT_CLASS: Record<NotificationType, string> = {
  "run-complete": "bg-hive-amber",
  reminder: "bg-hive-cyan",
  nudge: "bg-hive-yellow",
};

export function RecentActivityPanel({ notifications }: Props) {
  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ RECENT ACTIVITY ]
        </h3>
      </header>
      {notifications.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-hive-muted">No activity yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-hive-border">
          {notifications.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    DOT_CLASS[n.type] ?? "bg-hive-muted"
                  }`}
                  aria-label={n.type}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-hive-text truncate">{n.title}</p>
                    <span className="font-mono text-[11px] text-hive-muted shrink-0">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 text-xs text-hive-muted line-clamp-2">
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
