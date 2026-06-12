import "server-only";

import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

import { loadAppConfig, loadProjectsConfig } from "@/lib/config";
import type { ReminderRow } from "@/lib/contracts";
import { notificationRow, sendNativeNotification } from "@/lib/notify";
import { insertNotification } from "@/lib/repos/notifications";
import { listProjectIndex } from "@/lib/repos/projectIndex";
import {
  dueRemindersBefore,
  insertReminder,
  listRemindersForProject,
  updateReminderStatus,
} from "@/lib/repos/reminders";
import {
  advanceTemplateNextRun,
  listDueRecurringTemplates,
  spawnInstanceFromTemplate,
} from "@/lib/repos/tasks";
import {
  advanceNextRunAt as advanceAutomationNextRunAt,
  listDueAutomations,
} from "@/lib/repos/automations";
import { startRun as startAutomationRun } from "@/lib/automations/orchestrator";

const NUDGE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let started = false;
let jobs: ScheduledTask[] = [];
let tickInFlight = false;
let lastTickAt: string | null = null;
let lastNudgeCheckMs = 0;
let startedAtIso: string | null = null;

async function fireReminder(r: ReminderRow): Promise<void> {
  const type = r.kind === "auto-nudge" ? "nudge" : "reminder";
  const title = r.kind === "auto-nudge" ? "Hive nudge" : "Hive reminder";

  // Mark fired BEFORE the (slow) native notification so an overlapping tick
  // or a crash mid-send can never fire the same reminder twice.
  updateReminderStatus(r.id, "fired");

  await sendNativeNotification({ title, message: r.message });

  insertNotification(
    notificationRow({
      type,
      title,
      body: r.message,
      project_id: r.project_id,
    }),
  );
}

function checkAutoNudges(nowMs: number): void {
  const { autoNudgeAfterDays } = loadAppConfig();
  if (!autoNudgeAfterDays || autoNudgeAfterDays <= 0) return;

  const { projects } = loadProjectsConfig();
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const threshold = autoNudgeAfterDays * DAY_MS;
  const nowIso = new Date(nowMs).toISOString();

  for (const row of listProjectIndex()) {
    if (row.status === "done") continue;

    const lastIso = row.last_session_at ?? row.indexed_at;
    const lastMs = Date.parse(lastIso);
    if (Number.isNaN(lastMs)) continue;

    const ageMs = nowMs - lastMs;
    if (ageMs < threshold) continue;

    // Skip when a nudge is pending OR one was created within the staleness
    // window (fired/dismissed) — otherwise a stale project would get a fresh
    // nudge every hourly check, forever.
    const existing = listRemindersForProject(row.project_id);
    const hasRecentNudge = existing.some((r) => {
      if (r.kind !== "auto-nudge") return false;
      if (r.status === "pending") return true;
      const createdMs = Date.parse(r.created_at);
      return !Number.isNaN(createdMs) && nowMs - createdMs < threshold;
    });
    if (hasRecentNudge) continue;

    const days = Math.floor(ageMs / DAY_MS);
    const projectName = nameById.get(row.project_id) ?? row.project_id;
    const reminder: ReminderRow = {
      id: crypto.randomUUID(),
      project_id: row.project_id,
      message: `Project '${projectName}' is stale (last activity ${days} days ago).`,
      due_at: nowIso,
      kind: "auto-nudge",
      status: "pending",
      created_at: nowIso,
    };
    insertReminder(reminder);
  }
}

function tickAutomations(nowIso: string): void {
  let due;
  try {
    due = listDueAutomations(nowIso);
  } catch (err) {
    process.stderr.write(
      `[scheduler] listDueAutomations failed: ${(err as Error).message}\n`,
    );
    return;
  }
  for (const a of due) {
    try {
      // Fire-and-forget — startRun spawns its own async loop. The catch
      // handles async rejections (e.g. automation with 0 steps).
      void startAutomationRun(a.id, "schedule").catch((err: Error) => {
        process.stderr.write(
          `[scheduler] startAutomationRun '${a.id}' rejected: ${err.message}\n`,
        );
      });
    } catch (err) {
      process.stderr.write(
        `[scheduler] startAutomationRun '${a.id}' failed: ${(err as Error).message}\n`,
      );
    }
    try {
      advanceAutomationNextRunAt(a.id);
    } catch (err) {
      process.stderr.write(
        `[scheduler] advanceAutomationNextRunAt '${a.id}' failed: ${(err as Error).message}\n`,
      );
    }
  }
}

function tickRecurringTasks(nowIso: string): void {
  let due;
  try {
    due = listDueRecurringTemplates(nowIso);
  } catch (err) {
    process.stderr.write(
      `[scheduler] listDueRecurringTemplates failed: ${(err as Error).message}\n`,
    );
    return;
  }

  for (const tpl of due) {
    try {
      spawnInstanceFromTemplate(tpl.id);
      insertNotification(
        notificationRow({
          type: "nudge",
          title: `Recurring task '${tpl.title}' queued`,
          body: `Created from schedule ${tpl.schedule ?? ""}`,
          project_id: tpl.project_id,
        }),
      );
    } catch (err) {
      process.stderr.write(
        `[scheduler] spawnInstance '${tpl.id}' failed: ${(err as Error).message}\n`,
      );
    }
    try {
      advanceTemplateNextRun(tpl.id);
    } catch (err) {
      process.stderr.write(
        `[scheduler] advanceTemplateNextRun '${tpl.id}' failed: ${(err as Error).message}\n`,
      );
    }
  }
}

async function tick(): Promise<void> {
  // Cron fires every minute whether or not the previous tick finished;
  // overlapping ticks would process the same due reminders twice.
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await tickOnce();
  } finally {
    tickInFlight = false;
  }
}

async function tickOnce(): Promise<void> {
  const nowMs = Date.now();
  lastTickAt = new Date(nowMs).toISOString();

  try {
    const due = dueRemindersBefore(lastTickAt);
    for (const r of due) {
      try {
        await fireReminder(r);
      } catch (err) {
        process.stderr.write(
          `[scheduler] fireReminder failed (${r.id}): ${(err as Error).message}\n`,
        );
      }
    }
  } catch (err) {
    process.stderr.write(
      `[scheduler] dueRemindersBefore failed: ${(err as Error).message}\n`,
    );
  }

  try {
    tickRecurringTasks(lastTickAt);
  } catch (err) {
    process.stderr.write(
      `[scheduler] tickRecurringTasks failed: ${(err as Error).message}\n`,
    );
  }

  try {
    tickAutomations(lastTickAt);
  } catch (err) {
    process.stderr.write(
      `[scheduler] tickAutomations failed: ${(err as Error).message}\n`,
    );
  }

  if (nowMs - lastNudgeCheckMs >= NUDGE_CHECK_INTERVAL_MS) {
    lastNudgeCheckMs = nowMs;
    try {
      checkAutoNudges(nowMs);
    } catch (err) {
      process.stderr.write(
        `[scheduler] checkAutoNudges failed: ${(err as Error).message}\n`,
      );
    }
  }
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  lastNudgeCheckMs = 0;
  startedAtIso = new Date().toISOString();

  const tickJob = cron.schedule("* * * * *", () => {
    void tick();
  });
  jobs.push(tickJob);

  process.stderr.write(`[scheduler] started (tick only, recurring tasks driven by tick)\n`);
}

// ISO timestamp of when the scheduler first booted in this process. Used by
// the dashboard footer to show app uptime. null until startScheduler() runs.
export function getSchedulerStartedAt(): string | null {
  return startedAtIso;
}

export function stopScheduler(): void {
  if (!started) return;
  for (const job of jobs) {
    try {
      void job.stop();
    } catch {
      // ignore
    }
  }
  jobs = [];
  started = false;
  lastTickAt = null;
  lastNudgeCheckMs = 0;
  startedAtIso = null;
}

export function getSchedulerStatus(): {
  running: boolean;
  jobs: number;
  lastTickAt: string | null;
} {
  return { running: started, jobs: jobs.length, lastTickAt };
}
