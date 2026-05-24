import "server-only";

import { CronExpressionParser } from "cron-parser";

import { getDb } from "@/lib/db";
import type {
  Automation,
  AutomationRow,
  AutomationStep,
  AutomationStepRow,
  AutomationStepType,
} from "@/lib/contracts";

const STEP_TYPES: readonly AutomationStepType[] = [
  "agent",
  "review_agent",
  "human_review",
];

function isStepType(s: string): s is AutomationStepType {
  return (STEP_TYPES as readonly string[]).includes(s);
}

function rowToStep(row: AutomationStepRow): AutomationStep {
  return {
    id: row.id,
    automationId: row.automation_id,
    order: row.step_order,
    type: isStepType(row.step_type) ? row.step_type : "agent",
    profileId: row.profile_id ?? null,
    prompt: row.prompt ?? null,
    reviewsStepId: row.reviews_step_id ?? null,
    maxRetries: row.max_retries ?? 3,
    waitForHuman: row.wait_for_human === 1,
  };
}

function rowToAutomation(
  row: AutomationRow,
  steps: AutomationStepRow[],
): Automation {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color,
    icon: row.icon,
    schedule: row.schedule ?? null,
    nextRunAt: row.next_run_at ?? null,
    enabled: row.enabled === 1,
    isTemplate: row.is_template === 1,
    steps: steps
      .slice()
      .sort((a, b) => a.step_order - b.step_order)
      .map(rowToStep),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "automation"
  );
}

function automationExists(id: string): boolean {
  const row = getDb()
    .prepare(`SELECT id FROM automations WHERE id = ?`)
    .get(id) as { id: string } | undefined;
  return !!row;
}

export function generateAutomationId(name: string): string {
  const base = slugify(name);
  if (!automationExists(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!automationExists(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function computeNextRunIso(cronExpr: string, after: Date): string | null {
  try {
    const it = CronExpressionParser.parse(cronExpr, { currentDate: after });
    return it.next().toDate().toISOString();
  } catch (err) {
    process.stderr.write(
      `[automations] cron parse failed '${cronExpr}': ${(err as Error).message}\n`,
    );
    return null;
  }
}

export interface InsertAutomationInput {
  id?: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  schedule?: string | null;
  enabled?: boolean;
  isTemplate?: boolean;
}

export function insertAutomation(input: InsertAutomationInput): Automation {
  const now = new Date().toISOString();
  const id = input.id ?? generateAutomationId(input.name);
  const schedule = input.schedule ?? null;
  const nextRunAt =
    schedule !== null ? computeNextRunIso(schedule, new Date()) : null;

  getDb()
    .prepare(
      `INSERT INTO automations
        (id, name, description, color, icon, schedule, next_run_at,
         enabled, is_template, created_at, updated_at)
       VALUES
        (@id, @name, @description, @color, @icon, @schedule, @next_run_at,
         @enabled, @is_template, @created_at, @updated_at)`,
    )
    .run({
      id,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#FFB000",
      icon: input.icon ?? "hexagon",
      schedule,
      next_run_at: nextRunAt,
      enabled: input.enabled === false ? 0 : 1,
      is_template: input.isTemplate ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

  const fetched = getAutomation(id);
  if (!fetched) throw new Error(`Inserted automation not found: ${id}`);
  return fetched;
}

export interface UpdateAutomationPatch {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  enabled?: boolean;
  isTemplate?: boolean;
}

export function updateAutomation(
  id: string,
  patch: UpdateAutomationPatch,
): Automation {
  const existing = getAutomation(id);
  if (!existing) throw new Error(`Automation not found: ${id}`);

  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.name !== undefined) {
    fields.push("name = @name");
    params.name = patch.name;
  }
  if (patch.description !== undefined) {
    fields.push("description = @description");
    params.description = patch.description ?? null;
  }
  if (patch.color !== undefined) {
    fields.push("color = @color");
    params.color = patch.color;
  }
  if (patch.icon !== undefined) {
    fields.push("icon = @icon");
    params.icon = patch.icon;
  }
  if (patch.enabled !== undefined) {
    fields.push("enabled = @enabled");
    params.enabled = patch.enabled ? 1 : 0;
  }
  if (patch.isTemplate !== undefined) {
    fields.push("is_template = @is_template");
    params.is_template = patch.isTemplate ? 1 : 0;
  }

  if (fields.length > 0) {
    fields.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE automations SET ${fields.join(", ")} WHERE id = @id`,
      )
      .run(params);
  }

  const fetched = getAutomation(id);
  if (!fetched) throw new Error(`Automation not found after update: ${id}`);
  return fetched;
}

export function deleteAutomation(id: string): void {
  getDb().prepare(`DELETE FROM automations WHERE id = ?`).run(id);
}

export function getAutomation(id: string): Automation | null {
  const row = getDb()
    .prepare(`SELECT * FROM automations WHERE id = ?`)
    .get(id) as AutomationRow | undefined;
  if (!row) return null;
  const steps = getDb()
    .prepare(
      `SELECT * FROM automation_steps WHERE automation_id = ? ORDER BY step_order ASC`,
    )
    .all(id) as AutomationStepRow[];
  return rowToAutomation(row, steps);
}

export interface ListAutomationsOpts {
  includeTemplates?: boolean;
}

export function listAutomations(
  opts: ListAutomationsOpts = {},
): Automation[] {
  const includeTemplates = opts.includeTemplates ?? true;
  const sql = includeTemplates
    ? `SELECT * FROM automations ORDER BY is_template ASC, name COLLATE NOCASE ASC`
    : `SELECT * FROM automations WHERE is_template = 0 ORDER BY name COLLATE NOCASE ASC`;
  const rows = getDb().prepare(sql).all() as AutomationRow[];
  if (rows.length === 0) return [];
  const allSteps = getDb()
    .prepare(
      `SELECT * FROM automation_steps WHERE automation_id IN (${rows
        .map(() => "?")
        .join(",")}) ORDER BY automation_id, step_order ASC`,
    )
    .all(...rows.map((r) => r.id)) as AutomationStepRow[];
  const stepsById = new Map<string, AutomationStepRow[]>();
  for (const s of allSteps) {
    const arr = stepsById.get(s.automation_id) ?? [];
    arr.push(s);
    stepsById.set(s.automation_id, arr);
  }
  return rows.map((r) => rowToAutomation(r, stepsById.get(r.id) ?? []));
}

export interface InsertStepInput {
  id?: string;
  automationId: string;
  order?: number;
  type: AutomationStepType;
  profileId?: string | null;
  prompt?: string | null;
  reviewsStepId?: string | null;
  maxRetries?: number;
  waitForHuman?: boolean;
}

export function insertStep(input: InsertStepInput): AutomationStep {
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const order = input.order ?? nextStepOrder(input.automationId);
  getDb()
    .prepare(
      `INSERT INTO automation_steps
        (id, automation_id, step_order, step_type, profile_id, prompt,
         reviews_step_id, max_retries, wait_for_human, created_at)
       VALUES
        (@id, @automation_id, @step_order, @step_type, @profile_id, @prompt,
         @reviews_step_id, @max_retries, @wait_for_human, @created_at)`,
    )
    .run({
      id,
      automation_id: input.automationId,
      step_order: order,
      step_type: input.type,
      profile_id: input.profileId ?? null,
      prompt: input.prompt ?? null,
      reviews_step_id: input.reviewsStepId ?? null,
      max_retries: input.maxRetries ?? 3,
      wait_for_human: input.waitForHuman ? 1 : 0,
      created_at: now,
    });
  touchAutomation(input.automationId);
  const row = getDb()
    .prepare(`SELECT * FROM automation_steps WHERE id = ?`)
    .get(id) as AutomationStepRow | undefined;
  if (!row) throw new Error(`Step insert vanished: ${id}`);
  return rowToStep(row);
}

export interface UpdateStepPatch {
  type?: AutomationStepType;
  profileId?: string | null;
  prompt?: string | null;
  reviewsStepId?: string | null;
  maxRetries?: number;
  waitForHuman?: boolean;
  order?: number;
}

export function updateStep(
  stepId: string,
  patch: UpdateStepPatch,
): AutomationStep {
  const existing = getDb()
    .prepare(`SELECT * FROM automation_steps WHERE id = ?`)
    .get(stepId) as AutomationStepRow | undefined;
  if (!existing) throw new Error(`Step not found: ${stepId}`);

  const fields: string[] = [];
  const params: Record<string, unknown> = { id: stepId };
  if (patch.type !== undefined) {
    fields.push("step_type = @step_type");
    params.step_type = patch.type;
  }
  if (patch.profileId !== undefined) {
    fields.push("profile_id = @profile_id");
    params.profile_id = patch.profileId ?? null;
  }
  if (patch.prompt !== undefined) {
    fields.push("prompt = @prompt");
    params.prompt = patch.prompt ?? null;
  }
  if (patch.reviewsStepId !== undefined) {
    fields.push("reviews_step_id = @reviews_step_id");
    params.reviews_step_id = patch.reviewsStepId ?? null;
  }
  if (patch.maxRetries !== undefined) {
    fields.push("max_retries = @max_retries");
    params.max_retries = patch.maxRetries;
  }
  if (patch.waitForHuman !== undefined) {
    fields.push("wait_for_human = @wait_for_human");
    params.wait_for_human = patch.waitForHuman ? 1 : 0;
  }
  if (patch.order !== undefined) {
    fields.push("step_order = @step_order");
    params.step_order = patch.order;
  }

  if (fields.length > 0) {
    getDb()
      .prepare(
        `UPDATE automation_steps SET ${fields.join(", ")} WHERE id = @id`,
      )
      .run(params);
    touchAutomation(existing.automation_id);
  }

  const row = getDb()
    .prepare(`SELECT * FROM automation_steps WHERE id = ?`)
    .get(stepId) as AutomationStepRow | undefined;
  if (!row) throw new Error(`Step gone after update: ${stepId}`);
  return rowToStep(row);
}

export function deleteStep(stepId: string): void {
  const existing = getDb()
    .prepare(`SELECT automation_id FROM automation_steps WHERE id = ?`)
    .get(stepId) as { automation_id: string } | undefined;
  if (!existing) return;
  getDb().prepare(`DELETE FROM automation_steps WHERE id = ?`).run(stepId);
  touchAutomation(existing.automation_id);
}

export function reorderSteps(
  automationId: string,
  orderedIds: string[],
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    let order = 1;
    const stmt = db.prepare(
      `UPDATE automation_steps SET step_order = ? WHERE id = ? AND automation_id = ?`,
    );
    for (const sid of orderedIds) {
      stmt.run(order, sid, automationId);
      order += 1;
    }
  });
  tx();
  touchAutomation(automationId);
}

export function nextStepOrder(automationId: string): number {
  const row = getDb()
    .prepare(
      `SELECT MAX(step_order) AS max_order FROM automation_steps WHERE automation_id = ?`,
    )
    .get(automationId) as { max_order: number | null } | undefined;
  return (row?.max_order ?? 0) + 1;
}

export function setSchedule(
  automationId: string,
  cronExpr: string | null,
): Automation {
  const nextIso =
    cronExpr === null ? null : computeNextRunIso(cronExpr, new Date());
  getDb()
    .prepare(
      `UPDATE automations SET schedule = @schedule, next_run_at = @next_run_at,
        updated_at = @updated_at WHERE id = @id`,
    )
    .run({
      id: automationId,
      schedule: cronExpr,
      next_run_at: nextIso,
      updated_at: new Date().toISOString(),
    });
  const fetched = getAutomation(automationId);
  if (!fetched) throw new Error(`Automation not found: ${automationId}`);
  return fetched;
}

export function listDueAutomations(nowIso: string): Automation[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM automations
       WHERE enabled = 1
         AND schedule IS NOT NULL
         AND next_run_at IS NOT NULL
         AND next_run_at <= ?`,
    )
    .all(nowIso) as AutomationRow[];
  if (rows.length === 0) return [];
  return rows.map((r) => {
    const steps = getDb()
      .prepare(
        `SELECT * FROM automation_steps WHERE automation_id = ? ORDER BY step_order ASC`,
      )
      .all(r.id) as AutomationStepRow[];
    return rowToAutomation(r, steps);
  });
}

export function advanceNextRunAt(automationId: string): void {
  const row = getDb()
    .prepare(
      `SELECT schedule FROM automations WHERE id = ?`,
    )
    .get(automationId) as { schedule: string | null } | undefined;
  if (!row || !row.schedule) return;
  const nextIso = computeNextRunIso(row.schedule, new Date());
  getDb()
    .prepare(
      `UPDATE automations SET next_run_at = @next_run_at, updated_at = @updated_at
       WHERE id = @id`,
    )
    .run({
      id: automationId,
      next_run_at: nextIso,
      updated_at: new Date().toISOString(),
    });
}

function touchAutomation(automationId: string): void {
  getDb()
    .prepare(`UPDATE automations SET updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), automationId);
}
