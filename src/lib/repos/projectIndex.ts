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

// Compara los campos con significado real; indexed_at cambia en cada lectura
// y no debe contar como "cambio" (si contara, cada render del dashboard
// publicaría un evento y el SSE entraría en bucle de refresco).
function rowDataChanged(
  existing: ProjectIndexRow | null,
  row: ProjectIndexRow,
): boolean {
  if (!existing) return true;
  return (
    existing.status !== row.status ||
    existing.next_step !== row.next_step ||
    existing.last_session_at !== row.last_session_at ||
    existing.git_branch !== row.git_branch ||
    existing.git_dirty !== row.git_dirty
  );
}

export function upsertProjectIndex(row: ProjectIndexRow): void {
  const changed = rowDataChanged(getProjectIndex(row.project_id), row);
  getUpsertStmt().run(row);
  if (changed) {
    projectBus.publish({ type: "project_index.updated", row });
  }
}

export function getProjectIndex(projectId: string): ProjectIndexRow | null {
  const row = getGetStmt().get(projectId) as ProjectIndexRow | undefined;
  return row ?? null;
}

export function listProjectIndex(): ProjectIndexRow[] {
  return getListStmt().all() as ProjectIndexRow[];
}
