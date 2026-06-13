import Link from "next/link";

import { ReminderRowActions } from "@/components/ReminderRowActions";
import type { ReminderRow } from "@/lib/contracts";
import { formatRelative, isOverdue } from "@/lib/time";

type ReminderItem = ReminderRow & { projectName?: string };

type Props = {
  reminders: ReminderItem[];
};

export function RemindersPanel({ reminders }: Props) {
  return (
    <section className="hive-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground">
          Reminders
        </h3>
        <Link
          href="/reminders"
          className="font-mono text-[11px] text-faint transition-colors hover:text-primary"
        >
          View all
        </Link>
      </header>
      {reminders.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-faint">
          No pending reminders
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {reminders.map((r) => {
            const overdue = isOverdue(r.due_at);
            return (
              <li
                key={r.id}
                className="flex min-h-11 items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                    overdue ? "bg-warning" : "bg-info"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {r.message}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                    <span className={overdue ? "text-warning" : "text-info"}>
                      due {formatRelative(r.due_at)}
                    </span>
                    {r.projectName ? <> · {r.projectName}</> : null}
                  </p>
                </div>
                <div className="shrink-0 pt-px">
                  <ReminderRowActions reminderId={r.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
