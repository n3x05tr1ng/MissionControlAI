import "server-only";

import { CronExpressionParser } from "cron-parser";

import { DashboardLiveBridge } from "@/components/DashboardLiveBridge";
import { ActiveNow } from "@/components/dashboard/ActiveNow";
import { DashboardFooter } from "@/components/dashboard/Footer";
import { Hero } from "@/components/dashboard/Hero";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { ProjectsGrid } from "@/components/dashboard/ProjectsGrid";
import {
  RecentSessions,
  type EnrichedSession,
} from "@/components/dashboard/RecentSessions";
import {
  UpcomingRecurring,
  type UpcomingRecurringItem,
} from "@/components/dashboard/UpcomingRecurring";
import { NewProjectButton } from "@/components/NewProjectButton";
import { NewProjectEmptyState } from "@/components/NewProjectEmptyState";
import { RecentActivityPanel } from "@/components/RecentActivityPanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { KpiCards } from "@/components/stats/KpiCards";
import { RunsChart } from "@/components/stats/RunsChart";
import { getDb } from "@/lib/db";
import type { ReminderRow, SessionRow } from "@/lib/contracts";
import { isOnboardingDone } from "@/lib/onboarding";
import { readAllSnapshots } from "@/lib/projectReader";
import { listProfiles } from "@/lib/repos/profiles";
import { recentNotifications } from "@/lib/repos/notifications";
import { listPendingReminders } from "@/lib/repos/reminders";
import { listProjects } from "@/lib/repos/projects";
import {
  listTasks,
  tasksCountByProject,
} from "@/lib/repos/tasks";
import { getSchedulerStartedAt } from "@/lib/scheduler";
import {
  allTimeTotals,
  kpis as statsKpis,
  recentFailedSessions,
  runsLastNDays,
  topProfileAllTime,
} from "@/lib/stats/queries";
import { compareByStatus } from "@/lib/statusOrder";

const RECENT_SESSIONS_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pull a small batch directly so the dashboard can show cross-project sessions
// without going through per-project repos.
function recentSessionsRaw(limit: number): SessionRow[] {
  return getDb()
    .prepare(`SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as SessionRow[];
}

function computeUpcomingRecurring(
  templates: ReturnType<typeof listTasks>,
  projectNameById: Map<string, string>,
): UpcomingRecurringItem[] {
  const now = Date.now();
  const horizon = now + DAY_MS;
  const items: UpcomingRecurringItem[] = [];

  for (const t of templates) {
    if (!t.schedule) continue;

    // Prefer the stored next_run_at; recompute from cron if missing or stale.
    let nextMs: number | null = null;
    if (t.next_run_at) {
      const parsed = Date.parse(t.next_run_at);
      if (Number.isFinite(parsed) && parsed >= now) nextMs = parsed;
    }
    if (nextMs === null) {
      try {
        const it = CronExpressionParser.parse(t.schedule, {
          currentDate: new Date(now),
        });
        nextMs = it.next().toDate().getTime();
      } catch {
        continue;
      }
    }

    if (nextMs > horizon) continue;
    items.push({
      taskId: t.id,
      title: t.title,
      projectId: t.project_id,
      projectName: projectNameById.get(t.project_id) ?? t.project_id,
      cron: t.schedule,
      nextRunAt: new Date(nextMs).toISOString(),
    });
  }

  return items.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).slice(0, 5);
}

export async function Dashboard() {
  // Parallel-fetch every read the dashboard needs. Most of these touch SQLite
  // synchronously; wrapping with Promise.resolve keeps the call site uniform
  // and frees the await to keep snapshots (the only async one) running.
  const [
    snapshotsRaw,
    kpis,
    runs14d,
    pendingReminders,
    notifications,
    allTasksList,
    recurringTemplates,
    recentSessionsRows,
    projects,
    allProfilesForNames,
    failedRuns,
    totals,
    topProfile,
  ] = await Promise.all([
    readAllSnapshots(),
    Promise.resolve(statsKpis()),
    Promise.resolve(runsLastNDays(14)),
    Promise.resolve(listPendingReminders()),
    Promise.resolve(recentNotifications(10)),
    Promise.resolve(listTasks()),
    Promise.resolve(listTasks({ recurringTemplate: true })),
    Promise.resolve(recentSessionsRaw(8)),
    Promise.resolve(listProjects()),
    Promise.resolve(listProfiles({ includeTemplates: true })),
    Promise.resolve(recentFailedSessions(24, 5)),
    Promise.resolve(allTimeTotals()),
    Promise.resolve(topProfileAllTime()),
  ]);

  const tasksByProject = tasksCountByProject();
  const snapshots = [...snapshotsRaw].sort(compareByStatus);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  // Session attribution can reference template profiles, so we include them.
  const profileNameById = new Map(
    allProfilesForNames.map((p) => [p.id, p.name]),
  );

  const runningSnapshots = snapshots.filter(
    (s) => s.state.status === "running",
  );
  const blockedSnapshots = snapshots.filter(
    (s) => s.state.status === "blocked",
  );
  const needsInputSnapshots = snapshots.filter(
    (s) => s.state.status === "needs-input",
  );

  const nowIso = new Date().toISOString();
  const overdueReminders: Array<ReminderRow & { projectName?: string }> =
    pendingReminders
      .filter((r) => r.due_at <= nowIso)
      .map((r) => ({
        ...r,
        projectName: r.project_id
          ? projectNameById.get(r.project_id)
          : undefined,
      }));

  const enrichedReminders: Array<ReminderRow & { projectName?: string }> =
    pendingReminders.map((r) => ({
      ...r,
      projectName: r.project_id ? projectNameById.get(r.project_id) : undefined,
    }));

  const tasksInReview = allTasksList.filter(
    (t) => t.status === "review" && t.recurring_template === 0,
  );

  // Resolve profile name for each session. Prefer the session's own
  // profile_id (sessions launched from RunPanel now persist this), and fall
  // back to the legacy task → session join for older rows where the column
  // was NULL.
  const sessionToProfileViaTasks = new Map<string, string | null>();
  for (const t of allTasksList) {
    if (t.session_id) {
      const name = profileNameById.get(t.profile_id) ?? null;
      sessionToProfileViaTasks.set(t.session_id, name);
    }
  }
  const recentSessions: EnrichedSession[] = recentSessionsRows
    .slice(0, RECENT_SESSIONS_LIMIT)
    .map((s) => {
      const direct = s.profile_id
        ? profileNameById.get(s.profile_id) ?? null
        : null;
      const profileName = direct ?? sessionToProfileViaTasks.get(s.id) ?? null;
      return {
        ...s,
        projectName: projectNameById.get(s.project_id) ?? s.project_id,
        profileName,
      };
    });

  const upcomingRecurring = computeUpcomingRecurring(
    recurringTemplates,
    projectNameById,
  );

  const firstRun = !isOnboardingDone();
  const empty = snapshots.length === 0;

  return (
    <section className="max-w-7xl">
      <DashboardLiveBridge />

      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-mono text-xs tracking-widest text-hive-amber">
          [ DASHBOARD ]
        </h1>
        <NewProjectButton />
      </header>

      <div className="flex flex-col gap-4">
        <Hero
          firstRun={firstRun}
          projectsCount={snapshots.length}
          runningCount={runningSnapshots.length}
          needsInputCount={needsInputSnapshots.length}
          blockedCount={blockedSnapshots.length}
          tokensThisMonth={kpis.tokensThisMonth}
        />

        <NeedsAttention
          blocked={blockedSnapshots}
          needsInput={needsInputSnapshots}
          overdueReminders={overdueReminders}
          tasksInReview={tasksInReview}
          recentFailedRuns={failedRuns}
        />

        {!empty ? <ActiveNow /> : null}

        {!empty ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <KpiCards kpis={kpis} />
            </div>
            <div className="lg:col-span-4">
              <RunsChart data={runs14d} />
            </div>
          </div>
        ) : null}

        {empty ? (
          <NewProjectEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <ProjectsGrid
                snapshots={snapshots}
                tasksByProject={tasksByProject}
              />
            </div>
            <aside className="flex flex-col gap-4 lg:col-span-4">
              <UpcomingRecurring items={upcomingRecurring} />
              <RecentSessions sessions={recentSessions} />
              <RemindersPanel reminders={enrichedReminders} />
              <RecentActivityPanel notifications={notifications} />
            </aside>
          </div>
        )}

        <DashboardFooter
          totalRuns={totals.runs}
          totalTokens={totals.tokens}
          topProfile={topProfile?.profileName ?? null}
          uptimeStartedAt={getSchedulerStartedAt()}
        />
      </div>
    </section>
  );
}
