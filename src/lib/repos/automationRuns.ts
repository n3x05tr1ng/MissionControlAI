import "server-only";

import { getDb } from "@/lib/db";
import type {
  AutomationEventStatus,
  AutomationRun,
  AutomationRunEvent,
  AutomationRunEventRow,
  AutomationRunRow,
  AutomationRunStatus,
  AutomationTriggeredBy,
  ReviewVerdict,
} from "@/lib/contracts";

function safeParseContext(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function rowToEvent(row: AutomationRunEventRow): AutomationRunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    attempt: row.attempt,
    status: row.status,
    agentOutput: row.agent_output ?? null,
    reviewVerdict: row.review_verdict ?? null,
    reviewFeedback: row.review_feedback ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
  };
}

function rowToRun(
  row: AutomationRunRow,
  events: AutomationRunEventRow[],
): AutomationRun {
  return {
    id: row.id,
    automationId: row.automation_id,
    status: row.status,
    currentStepId: row.current_step_id ?? null,
    context: safeParseContext(row.context),
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    triggeredBy: row.triggered_by,
    error: row.error ?? null,
    finalOutput: row.final_output ?? null,
    events: events
      .slice()
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .map(rowToEvent),
  };
}

export interface InsertRunInput {
  id?: string;
  automationId: string;
  triggeredBy: AutomationTriggeredBy;
  status?: AutomationRunStatus;
}

export function insertRun(input: InsertRunInput): AutomationRun {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO automation_runs
        (id, automation_id, status, current_step_id, context,
         started_at, ended_at, triggered_by, error, final_output)
       VALUES
        (@id, @automation_id, @status, @current_step_id, @context,
         @started_at, @ended_at, @triggered_by, @error, @final_output)`,
    )
    .run({
      id,
      automation_id: input.automationId,
      status: input.status ?? "pending",
      current_step_id: null,
      context: "{}",
      started_at: now,
      ended_at: null,
      triggered_by: input.triggeredBy,
      error: null,
      final_output: null,
    });
  const fetched = getRun(id);
  if (!fetched) throw new Error(`Inserted run not found: ${id}`);
  return fetched;
}

export interface UpdateRunPatch {
  status?: AutomationRunStatus;
  currentStepId?: string | null;
  context?: Record<string, string>;
  endedAt?: string | null;
  error?: string | null;
  finalOutput?: string | null;
}

export function updateRun(id: string, patch: UpdateRunPatch): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.status !== undefined) {
    fields.push("status = @status");
    params.status = patch.status;
  }
  if (patch.currentStepId !== undefined) {
    fields.push("current_step_id = @current_step_id");
    params.current_step_id = patch.currentStepId ?? null;
  }
  if (patch.context !== undefined) {
    fields.push("context = @context");
    params.context = JSON.stringify(patch.context);
  }
  if (patch.endedAt !== undefined) {
    fields.push("ended_at = @ended_at");
    params.ended_at = patch.endedAt ?? null;
  }
  if (patch.error !== undefined) {
    fields.push("error = @error");
    params.error = patch.error ?? null;
  }
  if (patch.finalOutput !== undefined) {
    fields.push("final_output = @final_output");
    params.final_output = patch.finalOutput ?? null;
  }
  if (fields.length === 0) return;
  getDb()
    .prepare(`UPDATE automation_runs SET ${fields.join(", ")} WHERE id = @id`)
    .run(params);
}

export interface SetRunStatusOpts {
  endedAt?: string | null;
  error?: string | null;
  finalOutput?: string | null;
  currentStepId?: string | null;
}

export function setRunStatus(
  id: string,
  status: AutomationRunStatus,
  opts: SetRunStatusOpts = {},
): void {
  updateRun(id, {
    status,
    endedAt: opts.endedAt,
    error: opts.error,
    finalOutput: opts.finalOutput,
    currentStepId: opts.currentStepId,
  });
}

export function getRun(id: string): AutomationRun | null {
  const row = getDb()
    .prepare(`SELECT * FROM automation_runs WHERE id = ?`)
    .get(id) as AutomationRunRow | undefined;
  if (!row) return null;
  const events = getDb()
    .prepare(
      `SELECT * FROM automation_run_events WHERE run_id = ? ORDER BY started_at ASC`,
    )
    .all(id) as AutomationRunEventRow[];
  return rowToRun(row, events);
}

export function getRunRow(id: string): AutomationRunRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM automation_runs WHERE id = ?`)
    .get(id) as AutomationRunRow | undefined;
  return row ?? null;
}

export function listRunsForAutomation(
  automationId: string,
  limit = 50,
): AutomationRun[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM automation_runs WHERE automation_id = ?
       ORDER BY started_at DESC LIMIT ?`,
    )
    .all(automationId, limit) as AutomationRunRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const events = getDb()
    .prepare(
      `SELECT * FROM automation_run_events
       WHERE run_id IN (${ids.map(() => "?").join(",")})
       ORDER BY started_at ASC`,
    )
    .all(...ids) as AutomationRunEventRow[];
  const byRun = new Map<string, AutomationRunEventRow[]>();
  for (const e of events) {
    const arr = byRun.get(e.run_id) ?? [];
    arr.push(e);
    byRun.set(e.run_id, arr);
  }
  return rows.map((r) => rowToRun(r, byRun.get(r.id) ?? []));
}

export function listRecentRuns(limit = 50): AutomationRun[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM automation_runs ORDER BY started_at DESC LIMIT ?`,
    )
    .all(limit) as AutomationRunRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const events = getDb()
    .prepare(
      `SELECT * FROM automation_run_events
       WHERE run_id IN (${ids.map(() => "?").join(",")})
       ORDER BY started_at ASC`,
    )
    .all(...ids) as AutomationRunEventRow[];
  const byRun = new Map<string, AutomationRunEventRow[]>();
  for (const e of events) {
    const arr = byRun.get(e.run_id) ?? [];
    arr.push(e);
    byRun.set(e.run_id, arr);
  }
  return rows.map((r) => rowToRun(r, byRun.get(r.id) ?? []));
}

export interface InsertEventInput {
  id?: string;
  runId: string;
  stepId: string;
  attempt: number;
  status: AutomationEventStatus;
  agentOutput?: string | null;
  reviewVerdict?: ReviewVerdict | null;
  reviewFeedback?: string | null;
}

export function insertEvent(input: InsertEventInput): AutomationRunEvent {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO automation_run_events
        (id, run_id, step_id, attempt, status, agent_output,
         review_verdict, review_feedback, started_at, ended_at)
       VALUES
        (@id, @run_id, @step_id, @attempt, @status, @agent_output,
         @review_verdict, @review_feedback, @started_at, @ended_at)`,
    )
    .run({
      id,
      run_id: input.runId,
      step_id: input.stepId,
      attempt: input.attempt,
      status: input.status,
      agent_output: input.agentOutput ?? null,
      review_verdict: input.reviewVerdict ?? null,
      review_feedback: input.reviewFeedback ?? null,
      started_at: now,
      ended_at: null,
    });
  const row = getDb()
    .prepare(`SELECT * FROM automation_run_events WHERE id = ?`)
    .get(id) as AutomationRunEventRow | undefined;
  if (!row) throw new Error(`Event insert vanished: ${id}`);
  return rowToEvent(row);
}

export interface UpdateEventPatch {
  status?: AutomationEventStatus;
  agentOutput?: string | null;
  reviewVerdict?: ReviewVerdict | null;
  reviewFeedback?: string | null;
  endedAt?: string | null;
}

export function updateEvent(eventId: string, patch: UpdateEventPatch): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id: eventId };
  if (patch.status !== undefined) {
    fields.push("status = @status");
    params.status = patch.status;
  }
  if (patch.agentOutput !== undefined) {
    fields.push("agent_output = @agent_output");
    params.agent_output = patch.agentOutput ?? null;
  }
  if (patch.reviewVerdict !== undefined) {
    fields.push("review_verdict = @review_verdict");
    params.review_verdict = patch.reviewVerdict ?? null;
  }
  if (patch.reviewFeedback !== undefined) {
    fields.push("review_feedback = @review_feedback");
    params.review_feedback = patch.reviewFeedback ?? null;
  }
  if (patch.endedAt !== undefined) {
    fields.push("ended_at = @ended_at");
    params.ended_at = patch.endedAt ?? null;
  }
  if (fields.length === 0) return;
  getDb()
    .prepare(
      `UPDATE automation_run_events SET ${fields.join(", ")} WHERE id = @id`,
    )
    .run(params);
}

export function listEvents(runId: string): AutomationRunEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM automation_run_events WHERE run_id = ? ORDER BY started_at ASC`,
    )
    .all(runId) as AutomationRunEventRow[];
  return rows.map(rowToEvent);
}

export function findLatestAwaitingHumanEvent(
  runId: string,
): AutomationRunEvent | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM automation_run_events
       WHERE run_id = ? AND status = 'awaiting_human'
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(runId) as AutomationRunEventRow | undefined;
  return row ? rowToEvent(row) : null;
}

// Marks the latest awaiting_human event as resolved. Returns the event with
// the verdict applied so the orchestrator can act on it. Caller is responsible
// for actually resuming the run (see orchestrator.resumeRunAfterHuman).
export async function setHumanReviewDecision(
  runId: string,
  verdict: ReviewVerdict,
  feedback?: string,
): Promise<{ event: AutomationRunEvent; runStatusUpdated: boolean }> {
  const evt = findLatestAwaitingHumanEvent(runId);
  if (!evt) {
    throw new Error(`No awaiting_human event for run ${runId}`);
  }
  const status: AutomationEventStatus =
    verdict === "approve" ? "success" : "rejected";
  updateEvent(evt.id, {
    status,
    reviewVerdict: verdict,
    reviewFeedback: feedback ?? null,
    endedAt: new Date().toISOString(),
  });
  // Run is moved back to running by the orchestrator on resume; do not flip
  // here to avoid racing with the orchestrator's own status writes.
  const updated: AutomationRunEvent = {
    ...evt,
    status,
    reviewVerdict: verdict,
    reviewFeedback: feedback ?? null,
    endedAt: new Date().toISOString(),
  };

  // Defer to orchestrator. Imported lazily to avoid a circular dep.
  try {
    const mod = await import("@/lib/automations/orchestrator");
    void mod.resumeRunAfterHuman(runId, verdict, feedback);
  } catch (err) {
    process.stderr.write(
      `[automationRuns] resumeRunAfterHuman import failed: ${(err as Error).message}\n`,
    );
  }

  return { event: updated, runStatusUpdated: true };
}
