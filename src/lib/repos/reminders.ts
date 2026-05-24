import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { ReminderRow, ReminderStatus } from "@/lib/contracts";

let insertStmt: Statement | null = null;
let updateStatusStmt: Statement | null = null;
let listPendingStmt: Statement | null = null;
let listByProjectStmt: Statement | null = null;
let dueBeforeStmt: Statement | null = null;
let listAllRecentStmt: Statement | null = null;

function getInsertStmt(): Statement {
  if (!insertStmt) {
    insertStmt = getDb().prepare(
      `INSERT INTO reminders
        (id, project_id, message, due_at, kind, status, created_at)
       VALUES
        (@id, @project_id, @message, @due_at, @kind, @status, @created_at)`,
    );
  }
  return insertStmt;
}

function getUpdateStatusStmt(): Statement {
  if (!updateStatusStmt) {
    updateStatusStmt = getDb().prepare(
      `UPDATE reminders SET status = ? WHERE id = ?`,
    );
  }
  return updateStatusStmt;
}

function getListPendingStmt(): Statement {
  if (!listPendingStmt) {
    listPendingStmt = getDb().prepare(
      `SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_at ASC`,
    );
  }
  return listPendingStmt;
}

function getListByProjectStmt(): Statement {
  if (!listByProjectStmt) {
    listByProjectStmt = getDb().prepare(
      `SELECT * FROM reminders WHERE project_id = ? ORDER BY due_at ASC`,
    );
  }
  return listByProjectStmt;
}

function getDueBeforeStmt(): Statement {
  if (!dueBeforeStmt) {
    dueBeforeStmt = getDb().prepare(
      `SELECT * FROM reminders WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC`,
    );
  }
  return dueBeforeStmt;
}

export function insertReminder(row: ReminderRow): void {
  getInsertStmt().run(row);
}

export function updateReminderStatus(id: string, status: ReminderStatus): void {
  getUpdateStatusStmt().run(status, id);
}

export function listPendingReminders(): ReminderRow[] {
  return getListPendingStmt().all() as ReminderRow[];
}

export function listRemindersForProject(projectId: string): ReminderRow[] {
  return getListByProjectStmt().all(projectId) as ReminderRow[];
}

export function dueRemindersBefore(iso: string): ReminderRow[] {
  return getDueBeforeStmt().all(iso) as ReminderRow[];
}

function getListAllRecentStmt(): Statement {
  if (!listAllRecentStmt) {
    listAllRecentStmt = getDb().prepare(
      `SELECT * FROM reminders ORDER BY created_at DESC LIMIT ?`,
    );
  }
  return listAllRecentStmt;
}

export function listAllRemindersRecent(limit: number): ReminderRow[] {
  return getListAllRecentStmt().all(limit) as ReminderRow[];
}
