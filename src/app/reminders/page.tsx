import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { NewReminderForm } from "@/components/NewReminderForm";
import { ReminderRowActions } from "@/components/ReminderRowActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadProjectsConfig } from "@/lib/config";
import type { ReminderKind, ReminderRow } from "@/lib/contracts";
import {
  listAllRemindersRecent,
  listPendingReminders,
} from "@/lib/repos/reminders";
import { formatIso, formatRelative, isOverdue } from "@/lib/time";

export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 30;
const HISTORY_LIMIT_MAX = 990;

type KindFilter = "all" | ReminderKind;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseKind(value: string | undefined): KindFilter {
  return value === "manual" || value === "auto-nudge" ? value : "all";
}

function parseLimit(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < HISTORY_PAGE_SIZE) return HISTORY_PAGE_SIZE;
  return Math.min(n, HISTORY_LIMIT_MAX);
}

function historyHref(kind: KindFilter, limit: number): string {
  const params = new URLSearchParams();
  if (kind !== "all") params.set("kind", kind);
  if (limit !== HISTORY_PAGE_SIZE) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/reminders?${qs}` : "/reminders";
}

function KindBadge({ kind }: { kind: ReminderKind }) {
  return (
    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {kind}
    </span>
  );
}

function StatusPill({ status }: { status: ReminderRow["status"] }) {
  if (status === "fired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
        fired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-faint" />
      dismissed
    </span>
  );
}

const FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "auto-nudge", label: "Auto-nudge" },
];

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const kind = parseKind(first(sp.kind));
  const limit = parseLimit(first(sp.limit));
  const focusForm = first(sp.new) === "1";

  const pending = listPendingReminders();

  // Fetch a window large enough to fill the current page of history (the
  // recent list mixes pending + history) plus a buffer for kind filtering.
  const fetchCap = pending.length + limit + 150;
  const recent = listAllRemindersRecent(fetchCap);
  const historyAll = recent.filter((r) => r.status !== "pending");
  const filteredHistory =
    kind === "all" ? historyAll : historyAll.filter((r) => r.kind === kind);
  const visibleHistory = filteredHistory.slice(0, limit);
  const hasMore = filteredHistory.length > limit;

  const { projects } = loadProjectsConfig();
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const projectName = (r: ReminderRow): string | null =>
    r.project_id ? (nameById.get(r.project_id) ?? r.project_id) : null;

  const isEmpty = pending.length === 0 && historyAll.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        overline="Reminders"
        title="Reminders"
        description="Schedule one-off nudges for yourself, or let auto-nudges watch your projects."
      />

      <div className="flex flex-col gap-6">
        <NewReminderForm focusOnMount={focusForm} />

        {isEmpty ? (
          <EmptyState
            illustration="clock"
            title="No reminders yet"
            description="Nothing is scheduled. Set a reminder above, or wait for auto-nudges to fire when a project goes quiet."
            cta={{ label: "Set a reminder", modal: "newReminder" }}
          />
        ) : (
          <>
            <section
              aria-labelledby="pending-heading"
              className="hive-card animate-enter overflow-hidden"
              style={{ animationDelay: "60ms" }}
            >
              <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h2
                  id="pending-heading"
                  className="text-[12px] font-medium text-muted-foreground"
                >
                  Pending
                </h2>
                <span className="font-mono text-[11px] text-faint">
                  {pending.length}
                </span>
              </header>
              {pending.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-faint">
                  Nothing pending — your queue is clear.
                </p>
              ) : (
                <ul className="stagger-children divide-y divide-border">
                  {pending.map((r) => {
                    const overdue = isOverdue(r.due_at);
                    const name = projectName(r);
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
                          <p className="mt-0.5 font-mono text-[11px] text-faint">
                            <span
                              className={overdue ? "text-warning" : "text-info"}
                            >
                              due {formatRelative(r.due_at)}
                            </span>
                            {name ? <> · {name}</> : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-px">
                          <KindBadge kind={r.kind} />
                          <ReminderRowActions reminderId={r.id} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="history-heading"
              className="hive-card animate-enter overflow-hidden"
              style={{ animationDelay: "120ms" }}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <h2
                    id="history-heading"
                    className="text-[12px] font-medium text-muted-foreground"
                  >
                    History
                  </h2>
                  <span className="font-mono text-[11px] text-faint">
                    {filteredHistory.length}
                  </span>
                </div>
                <nav
                  aria-label="Filter history by type"
                  className="flex items-center gap-1"
                >
                  {FILTERS.map((f) => {
                    const active = f.value === kind;
                    return (
                      <Link
                        key={f.value}
                        href={historyHref(f.value, HISTORY_PAGE_SIZE)}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          active
                            ? "bg-primary-soft text-primary"
                            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </Link>
                    );
                  })}
                </nav>
              </header>
              {visibleHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-faint">
                  {kind === "all"
                    ? "No history yet — fired and dismissed reminders land here."
                    : `No ${kind} reminders in history.`}
                </p>
              ) : (
                <ul className="stagger-children divide-y divide-border">
                  {visibleHistory.map((r) => {
                    const name = projectName(r);
                    return (
                      <li
                        key={r.id}
                        className="flex min-h-11 items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <span
                          aria-hidden
                          className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                            r.status === "fired" ? "bg-primary" : "bg-faint"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-relaxed text-muted-foreground">
                            {r.message}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-faint">
                            {formatIso(r.created_at)}
                            {name ? <> · {name}</> : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-px">
                          <KindBadge kind={r.kind} />
                          <StatusPill status={r.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasMore ? (
                <footer className="border-t border-border">
                  <Link
                    href={historyHref(kind, limit + HISTORY_PAGE_SIZE)}
                    scroll={false}
                    className="flex h-10 items-center justify-center text-[12px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    Load more
                  </Link>
                </footer>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
