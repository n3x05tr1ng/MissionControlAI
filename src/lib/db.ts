import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

// HIVE_DATA_DIR lets desktop builds relocate the DB outside the app bundle.
const DATA_DIR = process.env.HIVE_DATA_DIR
  ? resolve(process.env.HIVE_DATA_DIR)
  : resolve(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "hive.db");

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  init(db);
  instance = db;
  return db;
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  name: string,
  decl: string,
): void {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  const has = info.some((c) => c.name === name);
  if (!has) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
  }
}

function init(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT,
      sandbox INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      model TEXT NOT NULL,
      result TEXT NOT NULL,
      cost_usd REAL,
      tokens_input INTEGER,
      tokens_output INTEGER,
      prompt TEXT NOT NULL,
      flags TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

    CREATE TABLE IF NOT EXISTS project_index (
      project_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      next_step TEXT,
      last_session_at TEXT,
      git_branch TEXT,
      git_dirty INTEGER NOT NULL DEFAULT 0,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      message TEXT NOT NULL,
      due_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_project_id ON reminders(project_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders(due_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- DEPRECATED in v0.3 (Wave C): superseded by recurring tasks. Retained for history.
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_path TEXT NOT NULL,
      trigger TEXT NOT NULL,
      cron TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- DEPRECATED in v0.3 (Wave C): superseded by recurring tasks. Retained for history.
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      log TEXT NOT NULL,
      triggered_by TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);

    CREATE TABLE IF NOT EXISTS assistant_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      prompt TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT 'claude-code',
      status TEXT NOT NULL DEFAULT 'backlog',
      sort_order REAL NOT NULL DEFAULT 0,
      session_id TEXT,
      flags TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status_order ON tasks(project_id, status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS agent_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT NOT NULL DEFAULT 'hexagon',
      color TEXT NOT NULL DEFAULT '#FFB000',
      system_prompt TEXT,
      model TEXT NOT NULL,
      allowed_tools TEXT NOT NULL DEFAULT '[]',
      mcp_servers TEXT NOT NULL DEFAULT '[]',
      permission_mode TEXT NOT NULL DEFAULT 'default',
      cost_cap_usd REAL,
      time_cap_seconds INTEGER,
      sandbox INTEGER NOT NULL DEFAULT 0,
      is_template INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_profiles_template_name ON agent_profiles(is_template, name);

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#FFB000',
      icon TEXT NOT NULL DEFAULT 'hexagon',
      schedule TEXT,
      next_run_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_template INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_automations_next_run_at ON automations(next_run_at);

    CREATE TABLE IF NOT EXISTS automation_steps (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      step_type TEXT NOT NULL,
      profile_id TEXT,
      prompt TEXT,
      reviews_step_id TEXT,
      max_retries INTEGER NOT NULL DEFAULT 3,
      wait_for_human INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_automation_steps_automation_order
      ON automation_steps(automation_id, step_order);

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step_id TEXT,
      context TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      triggered_by TEXT NOT NULL,
      error TEXT,
      final_output TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_started
      ON automation_runs(automation_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS automation_run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      agent_output TEXT,
      review_verdict TEXT,
      review_feedback TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_automation_run_events_run_started
      ON automation_run_events(run_id, started_at);
  `);

  // Idempotent ALTERs for migrations. SQLite ADD COLUMN can't be wrapped in
  // IF NOT EXISTS, so we gate on PRAGMA table_info before issuing the DDL.
  addColumnIfMissing(db, "tasks", "profile_id", "TEXT");
  addColumnIfMissing(db, "tasks", "schedule", "TEXT");
  addColumnIfMissing(db, "tasks", "next_run_at", "TEXT");
  addColumnIfMissing(
    db,
    "tasks",
    "recurring_template",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(db, "tasks", "parent_template_id", "TEXT");

  // Sessions launched directly from RunPanel (no task) used to have no profile
  // association. Carry the profile id on the session row itself so the UI can
  // attribute it without joining tasks.
  addColumnIfMissing(db, "sessions", "profile_id", "TEXT");

  // v0.5 one-shot: wipe legacy kanban tasks (Automations supersedes them).
  // Leaves project_index intact. Gated by a settings flag so it runs once.
  try {
    const flag = db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get("tasks_deprecated_v05") as { value: string } | undefined;
    if (!flag) {
      db.prepare(`DELETE FROM tasks`).run();
      db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      ).run("tasks_deprecated_v05", "1", new Date().toISOString());
      process.stderr.write(
        `[migration] tasks wiped (legacy v0.4 kanban)\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `[migration] tasks wipe failed: ${(err as Error).message}\n`,
    );
  }
}
