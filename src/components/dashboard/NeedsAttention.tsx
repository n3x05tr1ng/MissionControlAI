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

const actionLinkClass =
  "shrink-0 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground";

function Dot({ color }: { color: string }) {
  return (
    <span
      className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
      aria-hidden="true"
    />
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="text-[11px] font-medium text-faint">{label}</div>
  );
}

function MoreLine({ n }: { n: number }) {
  if (n <= 0) return null;
  return <li className="py-1.5 text-[11px] text-faint">…and {n} more</li>;
}

function Row({
  dot,
  title,
  meta,
  action,
}: {
  dot: string;
  title: string;
  meta: string;
  action: React.ReactNode;
}) {
  return (
    <li className="-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2">
      <div className="flex min-w-0 items-start gap-2">
        <Dot color={dot} />
        <div className="min-w-0">
          <p className="truncate text-[13px] text-foreground">{title}</p>
          <p className="truncate text-[12px] text-muted-foreground">{meta}</p>
        </div>
      </div>
      {action}
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
    <section className="hive-card animate-enter overflow-hidden border-warning/25">
      <header className="flex items-center justify-between gap-3 border-b border-warning/15 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-warning"
          >
            <path d="M12 3.5 21.5 20h-19z" />
            <path d="M12 10v4M12 17.2v.3" />
          </svg>
          Needs your attention
        </h2>
        <span className="rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning">
          {total} item{total === 1 ? "" : "s"}
        </span>
      </header>

      <div className="divide-y divide-border">
        {blocked.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="Blocked projects" />
            <ul className="mt-1">
              {blockedShown.map((s) => (
                <Row
                  key={s.config.id}
                  dot="bg-destructive"
                  title={s.config.name}
                  meta={s.state.blockers[0]?.trim() || "blocked"}
                  action={
                    <Link
                      href={`/projects/${s.config.id}`}
                      className={actionLinkClass}
                    >
                      Open
                    </Link>
                  }
                />
              ))}
              <MoreLine n={blocked.length - blockedShown.length} />
            </ul>
          </div>
        ) : null}

        {needsInput.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="Needs input" />
            <ul className="mt-1">
              {needsInputShown.map((s) => (
                <Row
                  key={s.config.id}
                  dot="bg-info"
                  title={s.config.name}
                  meta={s.state.openQuestions[0]?.trim() || "awaiting input"}
                  action={
                    <Link
                      href={`/projects/${s.config.id}`}
                      className={actionLinkClass}
                    >
                      Answer
                    </Link>
                  }
                />
              ))}
              <MoreLine n={needsInput.length - needsInputShown.length} />
            </ul>
          </div>
        ) : null}

        {overdueReminders.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="Overdue reminders" />
            <ul className="mt-1">
              {remindersShown.map((r) => (
                <Row
                  key={r.id}
                  dot="bg-warning"
                  title={r.message}
                  meta={`${r.projectName ? `${r.projectName} · ` : ""}${formatRelative(r.due_at)}`}
                  action={<ReminderRowActions reminderId={r.id} />}
                />
              ))}
              <MoreLine n={overdueReminders.length - remindersShown.length} />
            </ul>
          </div>
        ) : null}

        {tasksInReview.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="Tasks in review" />
            <ul className="mt-1">
              {reviewShown.map((t) => (
                <Row
                  key={t.id}
                  dot="bg-primary"
                  title={t.title}
                  meta="ready for your eyes"
                  action={
                    <Link
                      href={`/board?status=review&projectId=${encodeURIComponent(t.project_id)}`}
                      className={actionLinkClass}
                    >
                      Review
                    </Link>
                  }
                />
              ))}
              <MoreLine n={tasksInReview.length - reviewShown.length} />
            </ul>
          </div>
        ) : null}

        {recentFailedRuns.length > 0 ? (
          <div className="px-4 py-3">
            <GroupHeader label="Failed runs · last 24h" />
            <ul className="mt-1">
              {failedShown.map((s) => (
                <Row
                  key={s.id}
                  dot="bg-destructive"
                  title={s.projectName}
                  meta={`${formatRelative(s.started_at)} · ${s.model}`}
                  action={
                    <Link
                      href={`/projects/${s.project_id}?tab=sessions`}
                      className={actionLinkClass}
                    >
                      Inspect
                    </Link>
                  }
                />
              ))}
              <MoreLine n={recentFailedRuns.length - failedShown.length} />
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
