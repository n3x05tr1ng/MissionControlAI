import { EmptyState } from "@/components/EmptyState";
import { NewReminderForm } from "@/components/NewReminderForm";
import { ReminderRowActions } from "@/components/ReminderRowActions";
import { loadProjectsConfig } from "@/lib/config";
import type { ReminderRow } from "@/lib/contracts";
import {
  listAllRemindersRecent,
  listPendingReminders,
} from "@/lib/repos/reminders";
import { formatIso, formatRelative } from "@/lib/time";

export const dynamic = "force-dynamic";

function statusClass(status: ReminderRow["status"]): string {
  if (status === "pending") return "text-hive-cyan";
  if (status === "fired") return "text-hive-amber";
  return "text-hive-muted";
}

export default async function RemindersPage() {
  const pending = listPendingReminders();
  const recent = listAllRemindersRecent(30);
  const history = recent.filter(
    (r) => r.status === "fired" || r.status === "dismissed",
  );

  const { projects } = loadProjectsConfig();
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <section className="max-w-5xl flex flex-col gap-6">
      <header>
        <h1 className="font-mono text-xs tracking-widest text-hive-amber">
          [ REMINDERS ]
        </h1>
      </header>

      <NewReminderForm />

      {pending.length === 0 && history.length === 0 ? (
        <EmptyState
          title="No reminders"
          description="Set a manual reminder to ping you about a project, or wait for the auto-nudges to fire."
          cta={{ label: "+ New reminder", href: "#new-reminder" }}
        />
      ) : null}

      <section className="border border-hive-border bg-hive-panel">
        <header className="border-b border-hive-border px-4 py-2 flex items-baseline justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ PENDING ]
          </h2>
          <span className="font-mono text-[10px] text-hive-muted">
            {pending.length}
          </span>
        </header>
        {pending.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-hive-muted">No pending reminders</p>
          </div>
        ) : (
          <ul className="divide-y divide-hive-border">
            {pending.map((r) => {
              const projectName = r.project_id
                ? (nameById.get(r.project_id) ?? r.project_id)
                : null;
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-hive-cyan">
                      {formatRelative(r.due_at)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                        {r.kind}
                      </span>
                      <ReminderRowActions reminderId={r.id} />
                    </div>
                  </div>
                  {projectName ? (
                    <p className="font-mono text-[11px] text-hive-muted mt-0.5">
                      {projectName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-hive-text/90">{r.message}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border border-hive-border bg-hive-panel">
        <header className="border-b border-hive-border px-4 py-2 flex items-baseline justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ HISTORY ]
          </h2>
          <span className="font-mono text-[10px] text-hive-muted">
            {history.length}
          </span>
        </header>
        {history.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-hive-muted">No history yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-hive-border">
            {history.map((r) => {
              const projectName = r.project_id
                ? (nameById.get(r.project_id) ?? r.project_id)
                : null;
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`font-mono text-[11px] uppercase tracking-widest ${statusClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                    <span className="font-mono text-[11px] text-hive-muted">
                      {formatIso(r.created_at)}
                    </span>
                  </div>
                  {projectName ? (
                    <p className="font-mono text-[11px] text-hive-muted mt-0.5">
                      {projectName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-hive-text/80">{r.message}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
