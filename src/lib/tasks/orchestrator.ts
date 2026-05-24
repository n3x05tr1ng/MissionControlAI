import "server-only";

import { loadAppConfig } from "@/lib/config";
import type { AgentEvent, AgentProfile, LaunchFlags, TaskRow } from "@/lib/contracts";
import { startRun } from "@/lib/engine/runner";
import { subscribe } from "@/lib/engine/sessionBus";
import { notificationRow } from "@/lib/notify";
import { insertNotification } from "@/lib/repos/notifications";
import { getProfile } from "@/lib/repos/profiles";
import { getTask, updateTask } from "@/lib/repos/tasks";

// Per-task unsubscribe tracker, so we don't double-subscribe if startTask is
// invoked twice for the same task id.
const activeSubs = new Map<string, () => void>();

function buildFlags(task: TaskRow, profile: AgentProfile | null): LaunchFlags {
  const app = loadAppConfig();
  const defaults: LaunchFlags = {
    rawPrompt: task.prompt,
    finalPrompt: task.prompt,
    planMode: profile?.permissionMode === "plan",
    useSubagents: false,
    model: profile?.model ?? app.defaultEngineModel,
    allowedTools: profile?.allowedTools ?? [],
  };

  if (task.flags) {
    try {
      const parsed = JSON.parse(task.flags) as Partial<LaunchFlags>;
      return {
        ...defaults,
        ...parsed,
        rawPrompt: task.prompt,
        finalPrompt: task.prompt,
      };
    } catch (err) {
      process.stderr.write(
        `[orchestrator] invalid flags JSON for task ${task.id}: ${(err as Error).message}\n`,
      );
    }
  }

  return defaults;
}

function finish(taskId: string, projectId: string, taskTitle: string, result: "success" | "error", errorMessage?: string): void {
  const now = new Date().toISOString();
  if (result === "success") {
    try {
      updateTask(taskId, {
        status: "review",
        completed_at: now,
        last_error: null,
      });
    } catch (err) {
      process.stderr.write(
        `[orchestrator.finish.success] ${(err as Error).message}\n`,
      );
    }
  } else {
    try {
      updateTask(taskId, {
        status: "backlog",
        last_error: errorMessage ?? "unknown error",
        completed_at: null,
      });
    } catch (err) {
      process.stderr.write(
        `[orchestrator.finish.error] ${(err as Error).message}\n`,
      );
    }
  }

  try {
    insertNotification(
      notificationRow({
        type: "run-complete",
        title: `Task '${taskTitle}' ${result}`,
        body: result === "error" ? errorMessage ?? "" : "",
        project_id: projectId,
      }),
    );
  } catch (err) {
    process.stderr.write(
      `[orchestrator.finish.notify] ${(err as Error).message}\n`,
    );
  }

  const off = activeSubs.get(taskId);
  if (off) {
    try {
      off();
    } catch {
      /* noop */
    }
    activeSubs.delete(taskId);
  }
}

export interface StartTaskResult {
  sessionId: string;
}

export async function startTask(taskId: string): Promise<StartTaskResult> {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status !== "ready" && task.status !== "backlog") {
    throw new Error(
      `Task ${taskId} is not in a startable state (status=${task.status})`,
    );
  }

  const startedAt = new Date().toISOString();
  updateTask(taskId, {
    status: "running",
    started_at: startedAt,
    last_error: null,
  });

  const profile = task.profile_id ? getProfile(task.profile_id) : null;
  if (task.profile_id && !profile) {
    process.stderr.write(
      `[orchestrator] task ${task.id} references missing profile ${task.profile_id}; falling back to default\n`,
    );
  }
  const effectiveProfile = profile ?? getProfile("default");
  const flags = buildFlags(task, effectiveProfile);

  let sessionId: string;
  try {
    const result = await startRun(
      task.project_id,
      flags,
      effectiveProfile ?? undefined,
    );
    sessionId = result.sessionId;
  } catch (err) {
    // Engine refused to start — revert to backlog with error.
    const message = (err as Error).message;
    finish(taskId, task.project_id, task.title, "error", message);
    throw err;
  }

  updateTask(taskId, { session_id: sessionId });

  // Avoid double-subscribing.
  const existing = activeSubs.get(taskId);
  if (existing) {
    try {
      existing();
    } catch {
      /* noop */
    }
    activeSubs.delete(taskId);
  }

  let settled = false;
  const off = subscribe(task.project_id, (ev: AgentEvent) => {
    if (settled) return;
    if (ev.type === "session.end" && ev.sessionId === sessionId) {
      settled = true;
      finish(
        taskId,
        task.project_id,
        task.title,
        ev.result,
        ev.result === "error" ? "Session ended with error" : undefined,
      );
    } else if (ev.type === "error") {
      // Only treat as terminal if we haven't seen session.end yet.
      settled = true;
      finish(taskId, task.project_id, task.title, "error", ev.message);
    }
  });
  activeSubs.set(taskId, off);

  return { sessionId };
}
