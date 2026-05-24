import "server-only";

import { CronExpressionParser } from "cron-parser";
import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import {
  TASK_STATUSES,
  type TaskRow,
  type TaskStatus,
} from "@/lib/contracts";
import { taskBus } from "@/lib/realtime/bus";

const COLUMNS = [
  "id",
  "project_id",
  "title",
  "description",
  "prompt",
  "agent_id",
  "profile_id",
  "status",
  "sort_order",
  "session_id",
  "flags",
  "last_error",
  "created_at",
  "started_at",
  "completed_at",
  "schedule",
  "next_run_at",
  "recurring_template",
  "parent_template_id",
] as const;

type ColumnName = (typeof COLUMNS)[number];

let insertStmt: Statement | null = null;
let getStmt: Statement | null = null;
let deleteStmt: Statement | null = null;
const updateStmtCache = new Map<string, Statement>();

function getInsertStmt(): Statement {
  if (!insertStmt) {
    const cols = COLUMNS.join(", ");
    const placeholders = COLUMNS.map((c) => `@${c}`).join(", ");
    insertStmt = getDb().prepare(
      `INSERT INTO tasks (${cols}) VALUES (${placeholders})`,
    );
  }
  return insertStmt;
}

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(`SELECT * FROM tasks WHERE id = ?`);
  }
  return getStmt;
}

function getDeleteStmt(): Statement {
  if (!deleteStmt) {
    deleteStmt = getDb().prepare(`DELETE FROM tasks WHERE id = ?`);
  }
  return deleteStmt;
}

function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

function normalizeRow(row: TaskRow): TaskRow {
  return {
    ...row,
    description: row.description ?? null,
    profile_id: row.profile_id ?? "default",
    session_id: row.session_id ?? null,
    flags: row.flags ?? null,
    last_error: row.last_error ?? null,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    schedule: row.schedule ?? null,
    next_run_at: row.next_run_at ?? null,
    recurring_template: (row.recurring_template ?? 0) === 1 ? 1 : 0,
    parent_template_id: row.parent_template_id ?? null,
  };
}

export interface InsertTaskInput {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  prompt?: string;
  agent_id?: string;
  profile_id: string;
  status?: TaskStatus;
  sort_order?: number;
  session_id?: string | null;
  flags?: string | null;
  last_error?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  schedule?: string | null;
  next_run_at?: string | null;
  recurring_template?: 0 | 1;
  parent_template_id?: string | null;
}

export function insertTask(input: InsertTaskInput): TaskRow {
  const created_at = input.created_at ?? new Date().toISOString();
  const row: TaskRow = {
    id: input.id,
    project_id: input.project_id,
    title: input.title,
    description: input.description ?? null,
    prompt: input.prompt ?? "",
    agent_id: input.agent_id ?? "claude-code",
    profile_id: input.profile_id,
    status: input.status ?? "backlog",
    sort_order: input.sort_order ?? 0,
    session_id: input.session_id ?? null,
    flags: input.flags ?? null,
    last_error: input.last_error ?? null,
    created_at,
    started_at: input.started_at ?? null,
    completed_at: input.completed_at ?? null,
    schedule: input.schedule ?? null,
    next_run_at: input.next_run_at ?? null,
    recurring_template: input.recurring_template ?? 0,
    parent_template_id: input.parent_template_id ?? null,
  };
  getInsertStmt().run(row);
  taskBus.publish({ type: "task.created", task: normalizeRow(row) });
  return row;
}

export function backfillTaskProfileIds(defaultProfileId: string): number {
  const res = getDb()
    .prepare(
      `UPDATE tasks SET profile_id = ? WHERE profile_id IS NULL OR profile_id = ''`,
    )
    .run(defaultProfileId);
  return res.changes;
}

export function getTask(id: string): TaskRow | null {
  const row = getGetStmt().get(id) as TaskRow | undefined;
  return row ? normalizeRow(row) : null;
}

export interface ListTasksFilter {
  projectId?: string;
  status?: TaskStatus;
  recurringTemplate?: boolean;
}

export function listTasks(filter: ListTasksFilter = {}): TaskRow[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.projectId) {
    where.push("project_id = @projectId");
    params.projectId = filter.projectId;
  }
  if (filter.status) {
    where.push("status = @status");
    params.status = filter.status;
  }
  if (filter.recurringTemplate !== undefined) {
    where.push("recurring_template = @recurringTemplate");
    params.recurringTemplate = filter.recurringTemplate ? 1 : 0;
  }
  const sql = `SELECT * FROM tasks${
    where.length ? ` WHERE ${where.join(" AND ")}` : ""
  } ORDER BY status ASC, sort_order ASC, created_at ASC`;
  const rows = getDb().prepare(sql).all(params) as TaskRow[];
  return rows.map(normalizeRow);
}

export function updateTask(id: string, patch: Partial<TaskRow>): TaskRow {
  const keys = Object.keys(patch).filter(
    (k): k is ColumnName =>
      (COLUMNS as readonly string[]).includes(k) && k !== "id",
  );
  if (keys.length > 0) {
    const cacheKey = keys.join(",");
    let stmt = updateStmtCache.get(cacheKey);
    if (!stmt) {
      const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
      stmt = getDb().prepare(
        `UPDATE tasks SET ${setClause} WHERE id = @id`,
      );
      updateStmtCache.set(cacheKey, stmt);
    }
    const params: Record<string, unknown> = { id };
    for (const k of keys) params[k] = patch[k] ?? null;
    stmt.run(params);
  }
  const updated = getTask(id);
  if (!updated) throw new Error(`Task not found after update: ${id}`);
  taskBus.publish({ type: "task.updated", task: updated });
  return updated;
}

export function deleteTask(id: string): void {
  getDeleteStmt().run(id);
  taskBus.publish({ type: "task.deleted", id });
}

export function moveTask(
  id: string,
  status: TaskStatus,
  sortOrder: number,
): TaskRow {
  if (!isTaskStatus(status)) {
    throw new Error(`Invalid task status: ${status}`);
  }
  return updateTask(id, { status, sort_order: sortOrder });
}

export function nextSortOrder(
  status: TaskStatus,
  projectId?: string,
): number {
  const where: string[] = ["status = @status"];
  const params: Record<string, unknown> = { status };
  if (projectId) {
    where.push("project_id = @projectId");
    params.projectId = projectId;
  }
  const sql = `SELECT MAX(sort_order) AS max_order FROM tasks WHERE ${where.join(
    " AND ",
  )}`;
  const row = getDb().prepare(sql).get(params) as
    | { max_order: number | null }
    | undefined;
  const max = row?.max_order ?? null;
  return (max ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Recurring task helpers (Wave C)
// ---------------------------------------------------------------------------

function computeNextRunIso(cronExpr: string, after: Date): string | null {
  try {
    const it = CronExpressionParser.parse(cronExpr, { currentDate: after });
    return it.next().toDate().toISOString();
  } catch (err) {
    process.stderr.write(
      `[tasks] cron parse failed '${cronExpr}': ${(err as Error).message}\n`,
    );
    return null;
  }
}

export function setRecurrence(
  taskId: string,
  schedule: string | null,
): TaskRow {
  const existing = getTask(taskId);
  if (!existing) throw new Error(`Task not found: ${taskId}`);

  if (schedule === null) {
    return updateTask(taskId, {
      schedule: null,
      next_run_at: null,
      recurring_template: 0,
    });
  }

  const nextIso = computeNextRunIso(schedule, new Date());
  return updateTask(taskId, {
    schedule,
    next_run_at: nextIso,
    recurring_template: 1,
  });
}

export interface ProjectTaskCounts {
  open: number;
  running: number;
}

// Counts non-template tasks per project, partitioned by activity state. Used
// by the dashboard project grid to show "N open · M running" pills.
export function tasksCountByProject(): Record<string, ProjectTaskCounts> {
  const rows = getDb()
    .prepare(
      `SELECT project_id AS projectId,
              SUM(CASE WHEN status IN ('backlog','ready') AND recurring_template = 0 THEN 1 ELSE 0 END) AS open_count,
              SUM(CASE WHEN status = 'running' AND recurring_template = 0 THEN 1 ELSE 0 END) AS running_count
       FROM tasks
       GROUP BY project_id`,
    )
    .all() as Array<{
    projectId: string;
    open_count: number | null;
    running_count: number | null;
  }>;
  const out: Record<string, ProjectTaskCounts> = {};
  for (const r of rows) {
    out[r.projectId] = {
      open: r.open_count ?? 0,
      running: r.running_count ?? 0,
    };
  }
  return out;
}

export function listDueRecurringTemplates(nowIso: string): TaskRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM tasks
       WHERE recurring_template = 1
         AND schedule IS NOT NULL
         AND next_run_at IS NOT NULL
         AND next_run_at <= ?`,
    )
    .all(nowIso) as TaskRow[];
  return rows.map(normalizeRow);
}

export function spawnInstanceFromTemplate(templateId: string): TaskRow {
  const tpl = getTask(templateId);
  if (!tpl) throw new Error(`Template not found: ${templateId}`);

  const status: TaskStatus = "ready";
  const sortOrder = nextSortOrder(status, tpl.project_id);

  return insertTask({
    id: crypto.randomUUID(),
    project_id: tpl.project_id,
    title: tpl.title,
    description: tpl.description,
    prompt: tpl.prompt,
    agent_id: tpl.agent_id,
    profile_id: tpl.profile_id,
    status,
    sort_order: sortOrder,
    flags: tpl.flags,
    schedule: null,
    next_run_at: null,
    recurring_template: 0,
    parent_template_id: templateId,
  });
}

export function advanceTemplateNextRun(templateId: string): TaskRow {
  const tpl = getTask(templateId);
  if (!tpl) throw new Error(`Template not found: ${templateId}`);
  if (!tpl.schedule) {
    return updateTask(templateId, { next_run_at: null });
  }
  const nextIso = computeNextRunIso(tpl.schedule, new Date());
  return updateTask(templateId, { next_run_at: nextIso });
}
