import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { WorkflowRow } from "@/lib/contracts";

let upsertStmt: Statement | null = null;
let listStmt: Statement | null = null;
let getStmt: Statement | null = null;
let deleteStmt: Statement | null = null;

function getUpsertStmt(): Statement {
  if (!upsertStmt) {
    upsertStmt = getDb().prepare(
      `INSERT INTO workflows
        (id, name, source_path, trigger, cron, enabled, created_at, updated_at)
       VALUES
        (@id, @name, @source_path, @trigger, @cron, @enabled, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        source_path = excluded.source_path,
        trigger = excluded.trigger,
        cron = excluded.cron,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at`,
    );
  }
  return upsertStmt;
}

function getListStmt(): Statement {
  if (!listStmt) {
    listStmt = getDb().prepare(
      `SELECT * FROM workflows ORDER BY updated_at DESC`,
    );
  }
  return listStmt;
}

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(`SELECT * FROM workflows WHERE id = ?`);
  }
  return getStmt;
}

function getDeleteStmt(): Statement {
  if (!deleteStmt) {
    deleteStmt = getDb().prepare(`DELETE FROM workflows WHERE id = ?`);
  }
  return deleteStmt;
}

export function upsertWorkflow(row: WorkflowRow): void {
  getUpsertStmt().run(row);
}

export function listWorkflows(): WorkflowRow[] {
  return getListStmt().all() as WorkflowRow[];
}

export function getWorkflow(id: string): WorkflowRow | null {
  const row = getGetStmt().get(id) as WorkflowRow | undefined;
  return row ?? null;
}

export function deleteWorkflow(id: string): void {
  getDeleteStmt().run(id);
}
