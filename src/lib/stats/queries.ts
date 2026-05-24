import "server-only";

import { getDb } from "@/lib/db";
import type { SessionRow } from "@/lib/contracts";

export interface DayBucket {
  date: string;
  runs: number;
  tokens: number;
}

export interface DashboardKpis {
  runsThisWeek: number;
  tokensThisMonth: number;
  tasksDone: number;
  tasksOpen: number;
}

export interface ProjectUsageRow {
  projectId: string;
  projectName: string;
  runs: number;
  tokens: number;
  lastRunAt: string | null;
}

export interface AllTimeTotals {
  runs: number;
  tokens: number;
}

export interface TopProfile {
  profileName: string;
  runs: number;
}

export type RecentFailedSession = SessionRow & { projectName: string };

export interface ProfileUsage {
  runs: number;
  tokens: number;
  successRate: number;
  avgDurationSeconds: number;
  lastRunAt: string | null;
  runsLast14: Array<{ date: string; runs: number }>;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function buildDateBuckets(n: number): string[] {
  const out: string[] = [];
  const today = startOfTodayUtc();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}

// Tokens = input + output. Cheap SQL expression that handles NULLs.
const TOKENS_EXPR =
  "(COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0))";
const S_TOKENS_EXPR =
  "(COALESCE(s.tokens_input, 0) + COALESCE(s.tokens_output, 0))";

// Group sessions by YYYY-MM-DD for last N days. Backfills empty days with zeros.
export function runsLastNDays(n: number = 14): DayBucket[] {
  const sinceIso = daysAgoIso(n - 1);
  const rows = getDb()
    .prepare(
      `SELECT strftime('%Y-%m-%d', started_at) AS date,
              COUNT(*) AS runs,
              COALESCE(SUM(${TOKENS_EXPR}), 0) AS tokens
       FROM sessions
       WHERE started_at >= @since
       GROUP BY date`,
    )
    .all({ since: sinceIso }) as Array<{
    date: string;
    runs: number;
    tokens: number;
  }>;
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return buildDateBuckets(n).map((date) => {
    const row = byDate.get(date);
    return {
      date,
      runs: row?.runs ?? 0,
      tokens: row?.tokens ?? 0,
    };
  });
}

export function kpis(): DashboardKpis {
  const db = getDb();
  const sevenDaysAgo = daysAgoIso(7);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  const runsThisWeekRow = db
    .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE started_at >= ?`)
    .get(sevenDaysAgo) as { n: number };

  const tokensThisMonthRow = db
    .prepare(
      `SELECT COALESCE(SUM(${TOKENS_EXPR}), 0) AS total
       FROM sessions
       WHERE started_at >= ? AND result != 'running'`,
    )
    .get(monthStartIso) as { total: number };

  const tasksDoneRow = db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'`)
    .get() as { n: number };

  const tasksOpenRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks WHERE status NOT IN ('done','review')`,
    )
    .get() as { n: number };

  return {
    runsThisWeek: runsThisWeekRow.n,
    tokensThisMonth: tokensThisMonthRow.total,
    tasksDone: tasksDoneRow.n,
    tasksOpen: tasksOpenRow.n,
  };
}

export function runsByProject(): ProjectUsageRow[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id AS projectId,
              p.name AS projectName,
              COUNT(s.id) AS runs,
              COALESCE(SUM(${S_TOKENS_EXPR}), 0) AS tokens,
              MAX(s.started_at) AS lastRunAt
       FROM projects p
       LEFT JOIN sessions s ON s.project_id = p.id
       GROUP BY p.id, p.name
       ORDER BY runs DESC, p.name ASC`,
    )
    .all() as Array<{
    projectId: string;
    projectName: string;
    runs: number;
    tokens: number;
    lastRunAt: string | null;
  }>;
  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    runs: r.runs ?? 0,
    tokens: r.tokens ?? 0,
    lastRunAt: r.lastRunAt ?? null,
  }));
}

// Approximation: tasks store profile_id, and once a task runs the engine writes
// the session_id back onto the task. We join tasks -> sessions to attribute
// session usage to the profile that owned the task. Sessions kicked off
// directly (without a task) are not counted here.
export function usageByProfile(profileId: string): ProfileUsage {
  const db = getDb();

  const agg = db
    .prepare(
      `SELECT COUNT(s.id) AS runs,
              COALESCE(SUM(${S_TOKENS_EXPR}), 0) AS tokens,
              SUM(CASE WHEN s.result = 'success' THEN 1 ELSE 0 END) AS successes,
              SUM(CASE WHEN s.result != 'running' THEN 1 ELSE 0 END) AS completed,
              SUM(
                CASE
                  WHEN s.ended_at IS NOT NULL AND s.started_at IS NOT NULL
                  THEN (julianday(s.ended_at) - julianday(s.started_at)) * 86400.0
                  ELSE 0
                END
              ) AS totalDurationSec,
              SUM(
                CASE
                  WHEN s.ended_at IS NOT NULL AND s.started_at IS NOT NULL
                  THEN 1 ELSE 0
                END
              ) AS durationCount,
              MAX(s.started_at) AS lastRunAt
       FROM tasks t
       INNER JOIN sessions s ON s.id = t.session_id
       WHERE t.profile_id = ? AND t.session_id IS NOT NULL`,
    )
    .get(profileId) as {
    runs: number | null;
    tokens: number | null;
    successes: number | null;
    completed: number | null;
    totalDurationSec: number | null;
    durationCount: number | null;
    lastRunAt: string | null;
  };

  const runs = agg.runs ?? 0;
  const completed = agg.completed ?? 0;
  const successes = agg.successes ?? 0;
  const totalDur = agg.totalDurationSec ?? 0;
  const durCount = agg.durationCount ?? 0;

  const sinceIso = daysAgoIso(13);
  const dayRows = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', s.started_at) AS date,
              COUNT(*) AS runs
       FROM tasks t
       INNER JOIN sessions s ON s.id = t.session_id
       WHERE t.profile_id = ?
         AND t.session_id IS NOT NULL
         AND s.started_at >= ?
       GROUP BY date`,
    )
    .all(profileId, sinceIso) as Array<{ date: string; runs: number }>;
  const byDate = new Map(dayRows.map((r) => [r.date, r.runs]));
  const runsLast14 = buildDateBuckets(14).map((date) => ({
    date,
    runs: byDate.get(date) ?? 0,
  }));

  return {
    runs,
    tokens: agg.tokens ?? 0,
    successRate: completed > 0 ? successes / completed : 0,
    avgDurationSeconds: durCount > 0 ? totalDur / durCount : 0,
    lastRunAt: agg.lastRunAt,
    runsLast14,
  };
}

// Sessions that ended in 'error' within the last N hours, joined with the
// project name. Used by the dashboard's "Needs your attention" panel.
export function recentFailedSessions(
  hours: number = 24,
  limit: number = 5,
): RecentFailedSession[] {
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT s.*, p.name AS projectName
       FROM sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.result = 'error'
         AND s.started_at >= ?
       ORDER BY s.started_at DESC
       LIMIT ?`,
    )
    .all(sinceIso, limit) as Array<SessionRow & { projectName: string | null }>;
  return rows.map((r) => ({
    ...r,
    projectName: r.projectName ?? r.project_id,
  }));
}

// Top profile by lifetime run count. Joins tasks → sessions → profiles, so it
// only counts sessions kicked off via tasks (profile-attributed runs).
export function topProfileAllTime(): TopProfile | null {
  const row = getDb()
    .prepare(
      `SELECT ap.name AS profileName, COUNT(s.id) AS runs
       FROM tasks t
       INNER JOIN sessions s ON s.id = t.session_id
       INNER JOIN agent_profiles ap ON ap.id = t.profile_id
       WHERE t.session_id IS NOT NULL
       GROUP BY ap.id, ap.name
       ORDER BY runs DESC, ap.name ASC
       LIMIT 1`,
    )
    .get() as { profileName: string; runs: number } | undefined;
  if (!row || row.runs === 0) return null;
  return { profileName: row.profileName, runs: row.runs };
}

// Lifetime totals across every session in the DB.
export function allTimeTotals(): AllTimeTotals {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS runs, COALESCE(SUM(${TOKENS_EXPR}), 0) AS tokens FROM sessions`,
    )
    .get() as { runs: number; tokens: number };
  return { runs: row.runs ?? 0, tokens: row.tokens ?? 0 };
}

export function projectActivity(
  projectId: string,
  days: number = 14,
): DayBucket[] {
  const sinceIso = daysAgoIso(days - 1);
  const rows = getDb()
    .prepare(
      `SELECT strftime('%Y-%m-%d', started_at) AS date,
              COUNT(*) AS runs,
              COALESCE(SUM(${TOKENS_EXPR}), 0) AS tokens
       FROM sessions
       WHERE project_id = @projectId AND started_at >= @since
       GROUP BY date`,
    )
    .all({ projectId, since: sinceIso }) as Array<{
    date: string;
    runs: number;
    tokens: number;
  }>;
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return buildDateBuckets(days).map((date) => {
    const row = byDate.get(date);
    return {
      date,
      runs: row?.runs ?? 0,
      tokens: row?.tokens ?? 0,
    };
  });
}
