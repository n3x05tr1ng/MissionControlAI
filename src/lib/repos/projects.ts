import "server-only";

import type { Statement } from "better-sqlite3";
import { getDb } from "@/lib/db";
import type { ProjectConfig } from "@/lib/contracts";
import { projectBus } from "@/lib/realtime/bus";

interface ProjectRow {
  id: string;
  name: string;
  path: string;
  description: string | null;
  sandbox: 0 | 1;
  created_at: string;
  updated_at: string;
}

let insertStmt: Statement | null = null;
let getStmt: Statement | null = null;
let listStmt: Statement | null = null;
let deleteStmt: Statement | null = null;
let countStmt: Statement | null = null;

function getInsertStmt(): Statement {
  if (!insertStmt) {
    insertStmt = getDb().prepare(
      `INSERT INTO projects
        (id, name, path, description, sandbox, created_at, updated_at)
       VALUES
        (@id, @name, @path, @description, @sandbox, @created_at, @updated_at)`,
    );
  }
  return insertStmt;
}

function getGetStmt(): Statement {
  if (!getStmt) {
    getStmt = getDb().prepare(`SELECT * FROM projects WHERE id = ?`);
  }
  return getStmt;
}

function getListStmt(): Statement {
  if (!listStmt) {
    listStmt = getDb().prepare(
      `SELECT * FROM projects ORDER BY name COLLATE NOCASE ASC`,
    );
  }
  return listStmt;
}

function getDeleteStmt(): Statement {
  if (!deleteStmt) {
    deleteStmt = getDb().prepare(`DELETE FROM projects WHERE id = ?`);
  }
  return deleteStmt;
}

function getCountStmt(): Statement {
  if (!countStmt) {
    countStmt = getDb().prepare(`SELECT COUNT(*) as n FROM projects`);
  }
  return countStmt;
}

function rowToConfig(row: ProjectRow): ProjectConfig {
  const cfg: ProjectConfig = {
    id: row.id,
    name: row.name,
    path: row.path,
  };
  if (row.description) cfg.description = row.description;
  if (row.sandbox === 1) cfg.sandbox = true;
  return cfg;
}

export interface InsertProjectInput {
  id: string;
  name: string;
  path: string;
  description?: string;
  sandbox?: 0 | 1;
}

export function insertProject(row: InsertProjectInput): void {
  const now = new Date().toISOString();
  getInsertStmt().run({
    id: row.id,
    name: row.name,
    path: row.path,
    description: row.description ?? null,
    sandbox: row.sandbox ?? 0,
    created_at: now,
    updated_at: now,
  });
  const created = getProject(row.id);
  if (created) {
    projectBus.publish({ type: "project.created", project: created });
  }
}

export type UpdateProjectPatch = Partial<{
  name: string;
  path: string;
  description: string | null;
  sandbox: boolean;
}>;

export function updateProject(id: string, patch: UpdateProjectPatch): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (patch.name !== undefined) {
    fields.push("name = @name");
    params.name = patch.name;
  }
  if (patch.path !== undefined) {
    fields.push("path = @path");
    params.path = patch.path;
  }
  if (patch.description !== undefined) {
    fields.push("description = @description");
    params.description = patch.description;
  }
  if (patch.sandbox !== undefined) {
    fields.push("sandbox = @sandbox");
    params.sandbox = patch.sandbox ? 1 : 0;
  }

  fields.push("updated_at = @updated_at");
  params.updated_at = new Date().toISOString();

  if (fields.length === 1) return; // only updated_at — nothing to do

  const sql = `UPDATE projects SET ${fields.join(", ")} WHERE id = @id`;
  getDb().prepare(sql).run(params);
  const updated = getProject(id);
  if (updated) {
    projectBus.publish({ type: "project.updated", project: updated });
  }
}

export function deleteProject(id: string): void {
  getDeleteStmt().run(id);
  projectBus.publish({ type: "project.deleted", id });
}

export function getProject(id: string): ProjectConfig | null {
  const row = getGetStmt().get(id) as ProjectRow | undefined;
  return row ? rowToConfig(row) : null;
}

export function listProjects(): ProjectConfig[] {
  const rows = getListStmt().all() as ProjectRow[];
  return rows.map(rowToConfig);
}

export function countProjects(): number {
  const row = getCountStmt().get() as { n: number };
  return row.n;
}
