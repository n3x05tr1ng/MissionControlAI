import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { loadProjectsConfig } from "@/lib/config";
import type {
  AgentEvent,
  AgentProfile,
  LaunchFlags,
  ProjectState,
  SessionRow,
} from "@/lib/contracts";
import { clearBuffer, publish } from "@/lib/engine/sessionBus";
import { notificationRow, sendNativeNotification } from "@/lib/notify";
import { getDefaultProvider } from "@/lib/providers/registry";
import { insertNotification } from "@/lib/repos/notifications";
import { insertSession, updateSession } from "@/lib/repos/sessions";

export interface StartRunResult {
  sessionId: string;
}

interface ActiveRunEntry {
  projectId: string;
  controller: AbortController;
  startedAt: number;
}

const activeRuns = new Map<string, ActiveRunEntry>();

export interface ActiveRunInfo {
  sessionId: string;
  projectId: string;
  startedAt: number;
  ageMs: number;
}

export function listActiveRuns(): ActiveRunInfo[] {
  const now = Date.now();
  const out: ActiveRunInfo[] = [];
  for (const [sessionId, entry] of activeRuns) {
    out.push({
      sessionId,
      projectId: entry.projectId,
      startedAt: entry.startedAt,
      ageMs: now - entry.startedAt,
    });
  }
  return out;
}

export function stopRun(sessionId: string): boolean {
  const entry = activeRuns.get(sessionId);
  if (!entry) return false;
  try {
    entry.controller.abort();
  } catch {
    // ignore
  }
  activeRuns.delete(sessionId);
  const ts = new Date().toISOString();
  try {
    updateSession(sessionId, { ended_at: ts, result: "error" });
  } catch (err) {
    logError("stopRun.updateSession", err);
  }
  try {
    publish(entry.projectId, errorEvent(sessionId, "Stopped by user", ts));
    publish(entry.projectId, {
      type: "session.end",
      sessionId,
      result: "error",
      costUsd: 0,
      tokens: { input: 0, output: 0 },
      filesTouched: [],
      ts,
    });
  } catch (err) {
    logError("stopRun.publish", err);
  }
  return true;
}

export function stopRunsForProject(projectId: string): number {
  const ids: string[] = [];
  for (const [sessionId, entry] of activeRuns) {
    if (entry.projectId === projectId) ids.push(sessionId);
  }
  let stopped = 0;
  for (const id of ids) {
    if (stopRun(id)) stopped++;
  }
  return stopped;
}

export function stopAllRuns(): number {
  const ids = Array.from(activeRuns.keys());
  let stopped = 0;
  for (const id of ids) {
    if (stopRun(id)) stopped++;
  }
  return stopped;
}

export function writeProjectState(
  projectPath: string,
  state: ProjectState,
): void {
  const filePath = join(projectPath, ".claude", "state.json");
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function logError(scope: string, err: unknown): void {
  process.stderr.write(`[engine.${scope}] ${(err as Error).message}\n`);
}

// The "error" contract variant carries no sessionId; attach it as an extra
// field so consumers (e.g. the task orchestrator) can attribute the error to
// their own session instead of any session in the same project.
function errorEvent(sessionId: string, message: string, ts: string): AgentEvent {
  return { type: "error", message, ts, sessionId } as AgentEvent;
}

export async function startRun(
  projectId: string,
  flags: LaunchFlags,
  profile?: AgentProfile,
): Promise<StartRunResult> {
  const { projects } = loadProjectsConfig();
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const provider = getDefaultProvider();
  const isCli = provider.id === "claude-cli";

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // For the CLI provider, cost/tokens come back zero because the subscription
  // model doesn't surface per-call cost via PTY output. We record the model
  // (or a synthetic "claude-cli" label) for traceability and explicit zeros.
  const row: SessionRow = {
    id: runId,
    project_id: projectId,
    profile_id: profile?.id ?? null,
    started_at: startedAt,
    ended_at: null,
    model: isCli ? (profile?.model ?? flags.model ?? "claude-cli") : flags.model,
    result: "running",
    cost_usd: isCli ? 0 : null,
    tokens_input: isCli ? 0 : null,
    tokens_output: isCli ? 0 : null,
    prompt: flags.finalPrompt,
    flags: JSON.stringify(flags),
  };
  insertSession(row);

  // Start with a clean event buffer so SSE consumers don't see stale history.
  clearBuffer(projectId);

  const controller = new AbortController();
  activeRuns.set(runId, {
    projectId,
    controller,
    startedAt: Date.now(),
  });

  // Fire-and-forget background iteration. We intentionally do not await.
  void (async () => {
    try {
      for await (const ev of provider.run({
        projectPath: project.path,
        flags,
        resumeSessionId: undefined,
        profile,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) break;
        publish(
          projectId,
          ev.type === "error" ? errorEvent(runId, ev.message, ev.ts) : ev,
        );
        await handleEvent(projectId, project.path, runId, flags, ev);
        if (ev.type === "session.end") break;
      }
    } catch (err) {
      logError("runner", err);
      publish(
        projectId,
        errorEvent(runId, (err as Error).message, new Date().toISOString()),
      );
      try {
        updateSession(runId, {
          ended_at: new Date().toISOString(),
          result: "error",
        });
      } catch (dbErr) {
        logError("runner.updateSession", dbErr);
      }
    } finally {
      activeRuns.delete(runId);
    }
  })();

  return { sessionId: runId };
}

async function handleEvent(
  projectId: string,
  projectPath: string,
  runId: string,
  flags: LaunchFlags,
  ev: AgentEvent,
): Promise<void> {
  if (ev.type === "session.end") {
    try {
      updateSession(runId, {
        ended_at: ev.ts,
        result: ev.result,
        cost_usd: ev.costUsd,
        tokens_input: ev.tokens.input,
        tokens_output: ev.tokens.output,
      });
    } catch (err) {
      logError("handleEvent.updateSession", err);
    }

    try {
      const state: ProjectState = {
        projectId,
        status: ev.result === "success" ? "idle" : "blocked",
        nextStep: "",
        blockers: [],
        openQuestions: [],
        lastSession: {
          id: ev.sessionId,
          endedAt: ev.ts,
          model: flags.model,
          result: ev.result,
          costUsd: ev.costUsd,
          tokens: ev.tokens,
          filesTouched: ev.filesTouched,
        },
        updatedAt: ev.ts,
      };
      writeProjectState(projectPath, state);
    } catch (err) {
      logError("handleEvent.writeProjectState", err);
    }

    try {
      const title =
        ev.result === "success" ? "Run complete" : "Run failed";
      const totalTokens = ev.tokens.input + ev.tokens.output;
      const body = `Project ${projectId} finished — ${totalTokens} tokens`;
      await sendNativeNotification({ title, message: body });
      insertNotification(
        notificationRow({
          type: "run-complete",
          title,
          body,
          project_id: projectId,
        }),
      );
    } catch (err) {
      logError("handleEvent.notify", err);
    }
    return;
  }

  if (ev.type === "error") {
    try {
      updateSession(runId, {
        ended_at: ev.ts,
        result: "error",
      });
    } catch (err) {
      logError("handleEvent.updateSession.error", err);
    }
    try {
      const title = "Run errored";
      const body = ev.message.slice(0, 240);
      await sendNativeNotification({ title, message: body });
      insertNotification(
        notificationRow({
          type: "run-complete",
          title,
          body,
          project_id: projectId,
        }),
      );
    } catch (err) {
      logError("handleEvent.notify.error", err);
    }
  }
}
