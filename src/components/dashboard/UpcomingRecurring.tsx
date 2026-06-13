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
    <section className="hive-card animate-enter overflow-hidden">
      <header className="border-b border-border px-4 py-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground">
          Upcoming recurring
        </h3>
      </header>
      {items.length === 0 ? (
        <div className="p-4">
          <p className="text-[13px] text-muted-foreground">
            No recurring tasks scheduled in the next 24h.
          </p>
        </div>
      ) : (
        <ul className="stagger-children divide-y divide-border">
          {items.map((item) => (
            <li key={item.taskId} className="px-4 py-2.5 hover:bg-surface-2">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/board?projectId=${encodeURIComponent(item.projectId)}`}
                  className="truncate text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {item.title}
                </Link>
                <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 font-mono text-[11px] text-info">
                  {formatRelative(item.nextRunAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                {item.projectName} · {item.cron}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
