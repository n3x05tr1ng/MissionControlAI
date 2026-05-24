import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { WorkflowRunRow } from "@/lib/contracts";

const COLUMNS = [
  "id",
  "workflow_id",
  "status",
  "started_at",
  "ended_at",
  "log",
  "triggered_by",
] as const;

type ColumnName = (typeof COLUMNS)[number];

let insertStmt: Statement | null = null;
let listForWorkflowStmt: Statement | null = null;
const updateStmtCache = new Map<string, Statement>();

function getInsertStmt(): Statement {
  if (!insertStmt) {
    const cols = COLUMNS.join(", ");
    const placeholders = COLUMNS.map((c) => `@${c}`).join(", ");
    insertStmt = getDb().prepare(
      `INSERT INTO workflow_runs (${cols}) VALUES (${placeholders})`,
    );
  }
  return insertStmt;
}

function getListForWorkflowStmt(): Statement {
  if (!listForWorkflowStmt) {
    listForWorkflowStmt = getDb().prepare(
      `SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?`,
    );
  }
  return listForWorkflowStmt;
}

export function insertWorkflowRun(row: WorkflowRunRow): void {
  getInsertStmt().run(row);
}

export function updateWorkflowRun(
  id: string,
  patch: Partial<WorkflowRunRow>,
): void {
  const keys = Object.keys(patch).filter(
    (k): k is ColumnName => (COLUMNS as readonly string[]).includes(k) && k !== "id",
  );
  if (keys.length === 0) return;
  const cacheKey = keys.join(",");
  let stmt = updateStmtCache.get(cacheKey);
  if (!stmt) {
    const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
    stmt = getDb().prepare(
      `UPDATE workflow_runs SET ${setClause} WHERE id = @id`,
    );
    updateStmtCache.set(cacheKey, stmt);
  }
  const params: Record<string, unknown> = { id };
  for (const k of keys) params[k] = patch[k];
  stmt.run(params);
}

export function listRunsForWorkflow(
  workflowId: string,
  limit = 50,
): WorkflowRunRow[] {
  return getListForWorkflowStmt().all(workflowId, limit) as WorkflowRunRow[];
}
