import { ReminderRowActions } from "@/components/ReminderRowActions";
import type { ReminderRow } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type ReminderItem = ReminderRow & { projectName?: string };

type Props = {
  reminders: ReminderItem[];
};

export function RemindersPanel({ reminders }: Props) {
  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ REMINDERS ]
        </h3>
      </header>
      {reminders.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-hive-muted">No pending reminders</p>
        </div>
      ) : (
        <ul className="divide-y divide-hive-border">
          {reminders.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-hive-cyan">
                  {formatRelative(r.due_at)}
                </span>
                <div className="flex items-center gap-2">
                  {r.projectName ? (
                    <span className="font-mono text-[11px] text-hive-muted truncate">
                      {r.projectName}
                    </span>
                  ) : null}
                  <ReminderRowActions reminderId={r.id} />
                </div>
              </div>
              <p className="mt-1 text-sm text-hive-text/90">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
