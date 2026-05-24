import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { SessionRow } from "@/lib/contracts";

const COLUMNS = [
  "id",
  "project_id",
  "profile_id",
  "started_at",
  "ended_at",
  "model",
  "result",
  "cost_usd",
  "tokens_input",
  "tokens_output",
  "prompt",
  "flags",
] as const;

type ColumnName = (typeof COLUMNS)[number];

let insertStmt: Statement | null = null;
let getStmt: Statement | null = null;
let listByProjectStmt: Statement | null = null;
const updateStmtCache = new Map<string, Statement>();

function getInsertStmt(): Statement {
  if (!insertStmt) {
    const cols = COLUMNS.join(", ");
    const placeholders = COLUMNS.map((c) => `@${c}`).join(", ");
    insertStmt = getDb().prepare(
      `INSERT INTO sessions (${cols}) VALUES (${placeholders})`,
    );
  }
  return insertStmt;
}

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(`SELECT * FROM sessions WHERE id = ?`);
  }
  return getStmt;
}

function getListByProjectStmt(): Statement {
  if (!listByProjectStmt) {
    listByProjectStmt = getDb().prepare(
      `SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?`,
    );
  }
  return listByProjectStmt;
}

export function insertSession(row: SessionRow): void {
  getInsertStmt().run(row);
}

export function updateSession(id: string, patch: Partial<SessionRow>): void {
  const keys = Object.keys(patch).filter(
    (k): k is ColumnName => (COLUMNS as readonly string[]).includes(k) && k !== "id",
  );
  if (keys.length === 0) return;
  const cacheKey = keys.join(",");
  let stmt = updateStmtCache.get(cacheKey);
  if (!stmt) {
    const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
    stmt = getDb().prepare(
      `UPDATE sessions SET ${setClause} WHERE id = @id`,
    );
    updateStmtCache.set(cacheKey, stmt);
  }
  const params: Record<string, unknown> = { id };
  for (const k of keys) params[k] = patch[k];
  stmt.run(params);
}

export function getSession(id: string): SessionRow | null {
  const row = getGetStmt().get(id) as SessionRow | undefined;
  return row ?? null;
}

export function listSessionsForProject(
  projectId: string,
  limit = 50,
): SessionRow[] {
  return getListByProjectStmt().all(projectId, limit) as SessionRow[];
}
