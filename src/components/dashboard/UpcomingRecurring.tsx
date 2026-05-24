import "server-only";

import Link from "next/link";

import { formatRelative } from "@/lib/time";

export interface UpcomingRecurringItem {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  cron: string;
  nextRunAt: string;
}

type Props = {
  items: UpcomingRecurringItem[];
};

export function UpcomingRecurring({ items }: Props) {
  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ UPCOMING RECURRING ]
        </h3>
      </header>
      {items.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-hive-muted">
            No recurring tasks scheduled in the next 24h.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hive-border">
          {items.map((item) => (
            <li key={item.taskId} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/board?projectId=${encodeURIComponent(item.projectId)}`}
                  className="truncate text-sm text-hive-text hover:text-hive-amber"
                >
                  {item.title}
                </Link>
                <span className="shrink-0 font-mono text-[11px] text-hive-cyan">
                  {formatRelative(item.nextRunAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-hive-muted">
                {item.projectName} · {item.cron}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
