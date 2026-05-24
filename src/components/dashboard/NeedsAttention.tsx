import "server-only";

import Link from "next/link";

import { ReminderRowActions } from "@/components/ReminderRowActions";
import type {
  ProjectSnapshot,
  ReminderRow,
  SessionRow,
  TaskRow,
} from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type EnrichedReminder = ReminderRow & { projectName?: string };
type EnrichedFailedSession = SessionRow & { projectName: string };

type Props = {
  blocked: ProjectSnapshot[];
  needsInput: ProjectSnapshot[];
  overdueReminders: EnrichedReminder[];
  tasksInReview: TaskRow[];
  recentFailedRuns: EnrichedFailedSession[];
};

const GROUP_LIMIT = 3;

function Dot({ color }: { color: string }) {
  return (
    <span
      className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
      aria-hidden
    />
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
      {label}
    </div>
  );
}

function MoreLine({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <li className="px-4 py-1.5 text-[11px] text-hive-muted">
      …and {n} more
    </li>
  );
}

export function NeedsAttention({
  blocked,
  needsInput,
  overdueReminders,
  tasksInReview,
  recentFailedRuns,
}: Props) {
  const total =
    blocked.length +
    needsInput.length +
    overdueReminders.length +
    tasksInReview.length +
    recentFailedRuns.length;

  // Anti-overwhelm: render nothing when there's nothing to act on. A clean
  // dashboard is a feature, not a missing component.
  if (total === 0) return null;

  const blockedShown = blocked.slice(0, GROUP_LIMIT);
  const needsInputShown = needsInput.slice(0, GROUP_LIMIT);
  const remindersShown = overdueReminders.slice(0, GROUP_LIMIT);
  const reviewShown = tasksInReview.slice(0, GROUP_LIMIT);
  const failedShown = recentFailedRuns.slice(0, GROUP_LIMIT);

  return (
    <section className="border border-hive-amber/40 bg-hive-panel">
      <header className="flex items-center justify-between border-b border-hive-amber/30 px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ NEEDS YOUR ATTENTION ]
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          {total} item{total === 1 ? "" : "s"}
        </span>
      </header>

      <div className="divide-y divide-hive-border">
        {blocked.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="blocked projects" />
            <ul className="mt-1">
              {blockedShown.map((s) => {
                const reason = s.state.blockers[0]?.trim() || "blocked";
                return (
                  <li
                    key={s.config.id}
                    className="flex items-start justify-between gap-3 py-1.5"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Dot color="bg-hive-red" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-hive-text">
                          {s.config.name}
                        </p>
                        <p className="truncate text-xs text-hive-muted">
                          {reason}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${s.config.id}`}
                      className="shrink-0 border border-hive-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber hover:border-hive-amber"
                    >
                      open
                    </Link>
                  </li>
                );
              })}
              <MoreLine n={blocked.length - blockedShown.length} />
            </ul>
          </div>
        ) : null}

        {needsInput.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="needs input" />
            <ul className="mt-1">
              {needsInputShown.map((s) => {
                const question = s.state.openQuestions[0]?.trim() || "awaiting input";
                return (
                  <li
                    key={s.config.id}
                    className="flex items-start justify-between gap-3 py-1.5"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Dot color="bg-hive-cyan" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-hive-text">
                          {s.config.name}
                        </p>
                        <p className="truncate text-xs text-hive-muted">
                          {question}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${s.config.id}`}
                      className="shrink-0 border border-hive-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber hover:border-hive-amber"
                    >
                      open
                    </Link>
                  </li>
                );
              })}
              <MoreLine n={needsInput.length - needsInputShown.length} />
            </ul>
          </div>
        ) : null}

        {overdueReminders.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="overdue reminders" />
            <ul className="mt-1">
              {remindersShown.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 py-1.5"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Dot color="bg-hive-amber" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-hive-text">
                        {r.message}
                      </p>
                      <p className="truncate text-xs text-hive-muted">
                        {r.projectName ? `${r.projectName} · ` : ""}
                        {formatRelative(r.due_at)}
                      </p>
                    </div>
                  </div>
                  <ReminderRowActions reminderId={r.id} />
                </li>
              ))}
              <MoreLine n={overdueReminders.length - remindersShown.length} />
            </ul>
          </div>
        ) : null}

        {tasksInReview.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="tasks in review" />
            <ul className="mt-1">
              {reviewShown.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 py-1.5"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Dot color="bg-hive-amber" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-hive-text">
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-hive-muted">
                        ready for your eyes
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/board?status=review&projectId=${encodeURIComponent(t.project_id)}`}
                    className="shrink-0 border border-hive-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber hover:border-hive-amber"
                  >
                    review
                  </Link>
                </li>
              ))}
              <MoreLine n={tasksInReview.length - reviewShown.length} />
            </ul>
          </div>
        ) : null}

        {recentFailedRuns.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="failed runs · last 24h" />
            <ul className="mt-1">
              {failedShown.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 py-1.5"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Dot color="bg-hive-yellow" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-hive-text">
                        {s.projectName}
                      </p>
                      <p className="truncate text-xs text-hive-muted">
                        {formatRelative(s.started_at)} · {s.model}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${s.project_id}?tab=sessions`}
                    className="shrink-0 border border-hive-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber hover:border-hive-amber"
                  >
                    inspect
                  </Link>
                </li>
              ))}
              <MoreLine n={recentFailedRuns.length - failedShown.length} />
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
