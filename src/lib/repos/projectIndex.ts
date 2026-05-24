import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { ProjectIndexRow } from "@/lib/contracts";
import { projectBus } from "@/lib/realtime/bus";

let upsertStmt: Statement | null = null;
let getStmt: Statement | null = null;
let listStmt: Statement | null = null;

function getUpsertStmt(): Statement {
  if (!upsertStmt) {
    upsertStmt = getDb().prepare(
      `INSERT INTO project_index
        (project_id, status, next_step, last_session_at, git_branch, git_dirty, indexed_at)
       VALUES
        (@project_id, @status, @next_step, @last_session_at, @git_branch, @git_dirty, @indexed_at)
       ON CONFLICT(project_id) DO UPDATE SET
        status = excluded.status,
        next_step = excluded.next_step,
        last_session_at = excluded.last_session_at,
        git_branch = excluded.git_branch,
        git_dirty = excluded.git_dirty,
        indexed_at = excluded.indexed_at`,
    );
  }
  return upsertStmt;
}

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(
      `SELECT * FROM project_index WHERE project_id = ?`,
    );
  }
  return getStmt;
}

function getListStmt(): Statement {
  if (!listStmt) {
    listStmt = getDb().prepare(
      `SELECT * FROM project_index ORDER BY indexed_at DESC`,
    );
  }
  return listStmt;
}

export function upsertProjectIndex(row: ProjectIndexRow): void {
  getUpsertStmt().run(row);
  projectBus.publish({ type: "project_index.updated", row });
}

export function getProjectIndex(projectId: string): ProjectIndexRow | null {
  const row = getGetStmt().get(projectId) as ProjectIndexRow | undefined;
  return row ?? null;
}

export function listProjectIndex(): ProjectIndexRow[] {
  return getListStmt().all() as ProjectIndexRow[];
}
