import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { NotificationRow } from "@/lib/contracts";

let insertStmt: Statement | null = null;
let recentStmt: Statement | null = null;
let byProjectStmt: Statement | null = null;

function getInsertStmt(): Statement {
  if (!insertStmt) {
    insertStmt = getDb().prepare(
      `INSERT INTO notifications
        (id, project_id, type, title, body, created_at)
       VALUES
        (@id, @project_id, @type, @title, @body, @created_at)`,
    );
  }
  return insertStmt;
}

function getRecentStmt(): Statement {
  if (!recentStmt) {
    recentStmt = getDb().prepare(
      `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`,
    );
  }
  return recentStmt;
}

function getByProjectStmt(): Statement {
  if (!byProjectStmt) {
    byProjectStmt = getDb().prepare(
      `SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
    );
  }
  return byProjectStmt;
}

export function insertNotification(row: NotificationRow): void {
  getInsertStmt().run(row);
}

export function recentNotifications(limit: number): NotificationRow[] {
  return getRecentStmt().all(limit) as NotificationRow[];
}

export function notificationsForProject(
  projectId: string,
  limit = 50,
): NotificationRow[] {
  return getByProjectStmt().all(projectId, limit) as NotificationRow[];
}
