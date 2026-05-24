import "server-only";

import { loadAppConfig } from "@/lib/config";
import type {
  AgentEvent,
  AgentProfile,
  Automation,
  AutomationStep,
  LaunchFlags,
  ReviewVerdict,
} from "@/lib/contracts";
import { notificationRow, sendNativeNotification } from "@/lib/notify";
import { getDefaultProvider } from "@/lib/providers/registry";
import { automationBus } from "@/lib/realtime/bus";
import { getAutomation } from "@/lib/repos/automations";
import {
  findLatestAwaitingHumanEvent,
  getRun,
  getRunRow,
  insertEvent,
  insertRun,
  setRunStatus,
  updateEvent,
  updateRun,
} from "@/lib/repos/automationRuns";
import { insertNotification } from "@/lib/repos/notifications";
import { getProfile } from "@/lib/repos/profiles";

interface ActiveRunHandle {
  controller: AbortController;
  automationId: string;
  startedAt: number;
}

const activeRuns = new Map<string, ActiveRunHandle>();

export function listActiveAutomationRuns(): Array<{
  runId: string;
  automationId: string;
  startedAt: number;
}> {
  return Array.from(activeRuns.entries()).map(([runId, h]) => ({
    runId,
    automationId: h.automationId,
    startedAt: h.startedAt,
  }));
}

export interface StartRunResult {
  runId: string;
}

export async function startRun(
  automationId: string,
  triggeredBy: "manual" | "schedule" | "system",
): Promise<StartRunResult> {
  const automation = getAutomation(automationId);
  if (!automation) {
    throw new Error(`Automation not found: ${automationId}`);
  }
  if (automation.steps.length === 0) {
    throw new Error(`Automation has no steps: ${automationId}`);
  }

  const run = insertRun({
    automationId: automation.id,
    triggeredBy,
    status: "pending",
  });

  automationBus.publish({
    type: "automation.run.started",
    runId: run.id,
    automationId: automation.id,
  });

  const controller = new AbortController();
  activeRuns.set(run.id, {
    controller,
    automationId: automation.id,
    startedAt: Date.now(),
  });

  // Fire and forget — caller does not await execution.
  void executeRun(run.id, controller.signal).catch((err) => {
    process.stderr.write(
      `[orchestrator] executeRun ${run.id} threw: ${(err as Error).message}\n`,
    );
  });

  return { runId: run.id };
}

export function stopRun(runId: string): boolean {
  const handle = activeRuns.get(runId);
  if (!handle) return false;
  try {
    handle.controller.abort();
  } catch {
    // ignore
  }
  activeRuns.delete(runId);
  const now = new Date().toISOString();
  try {
    setRunStatus(runId, "error", {
      endedAt: now,
      error: "Stopped by user",
    });
    automationBus.publish({
      type: "automation.run.error",
      runId,
      message: "Stopped by user",
    });
  } catch (err) {
    process.stderr.write(
      `[orchestrator] stopRun cleanup failed: ${(err as Error).message}\n`,
    );
  }
  return true;
}

export async function resumeRunAfterHuman(
  runId: string,
  verdict: ReviewVerdict,
  feedback?: string,
): Promise<void> {
  const runRow = getRunRow(runId);
  if (!runRow) {
    process.stderr.write(
      `[orchestrator] resumeRunAfterHuman: run not found ${runId}\n`,
    );
    return;
  }
  if (runRow.status !== "awaiting_human") {
    process.stderr.write(
      `[orchestrator] resumeRunAfterHuman: run ${runId} not awaiting_human (was ${runRow.status})\n`,
    );
    return;
  }

  // Stash the human verdict into context so executeRun can read it on resume.
  const run = getRun(runId);
  if (!run) return;
  const ctx = { ...run.context };
  if (runRow.current_step_id) {
    ctx[`step_${runRow.current_step_id}.human_verdict`] = verdict;
    if (feedback) {
      ctx[`step_${runRow.current_step_id}.human_feedback`] = feedback;
    }
  }
  updateRun(runId, { context: ctx, status: "running" });

  const controller = new AbortController();
  activeRuns.set(runId, {
    controller,
    automationId: runRow.automation_id,
    startedAt: Date.now(),
  });

  void executeRun(runId, controller.signal).catch((err) => {
    process.stderr.write(
      `[orchestrator] resume executeRun ${runId} threw: ${(err as Error).message}\n`,
    );
  });
}

function renderTemplate(
  raw: string,
  context: Record<string, string>,
  stepIdByOrder: Map<number, string>,
): string {
  // Replace {{stepN.output}} and {{stepN}} -> context value.
  // Also support {{stepN.feedback}} for review feedback re-injection.
  return raw.replace(
    /\{\{\s*step(\d+)(?:\.(\w+))?(?:\|([^}]*))?\s*\}\}/g,
    (_match, num: string, attr: string | undefined, fallback: string | undefined) => {
      const stepNum = parseInt(num, 10);
      const stepId = stepIdByOrder.get(stepNum);
      if (!stepId) return fallback ?? "";
      const key = attr
        ? `step_${stepId}.${attr}`
        : `step_${stepId}.output`;
      const v = context[key];
      if (v === undefined || v === null) {
        return fallback ?? "";
      }
      return v;
    },
  );
}

function parseVerdict(text: string): {
  verdict: ReviewVerdict | null;
  feedback: string;
} {
  // Scan from the end backwards looking for APPROVE or REJECT: marker.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/^APPROVE\b/i.test(line)) {
      return { verdict: "approve", feedback: "" };
    }
    const m = line.match(/^REJECT\s*:\s*(.*)$/i);
    if (m) {
      return { verdict: "reject", feedback: m[1].trim() };
    }
  }
  return { verdict: null, feedback: "" };
}

interface RunAgentStepResult {
  ok: boolean;
  output: string;
  errorMessage?: string;
}

async function runAgentStep(
  runId: string,
  step: AutomationStep,
  renderedPrompt: string,
  attempt: number,
  signal: AbortSignal,
): Promise<RunAgentStepResult> {
  const profile = step.profileId ? getProfile(step.profileId) : null;
  const effectiveProfile = profile ?? getProfile("default") ?? null;
  const provider = getDefaultProvider();
  const app = loadAppConfig();

  const flags: LaunchFlags = {
    rawPrompt: renderedPrompt,
    finalPrompt: renderedPrompt,
    planMode: effectiveProfile?.permissionMode === "plan",
    useSubagents: false,
    model: effectiveProfile?.model ?? app.defaultEngineModel,
    allowedTools: effectiveProfile?.allowedTools ?? [],
  };

  let assistantOutput = "";
  let errored = false;
  let errorMessage = "";
  let sessionEnded = false;
  let sessionResult: "success" | "error" = "success";

  try {
    for await (const ev of provider.run({
      projectPath: process.cwd(),
      flags,
      profile: effectiveProfile ?? undefined,
      signal,
    } as { projectPath: string; flags: LaunchFlags; profile?: AgentProfile; signal: AbortSignal })) {
      if (signal.aborted) break;
      handleAgentEvent(runId, step.id, attempt, ev, (chunk) => {
        assistantOutput += chunk;
      });
      if (ev.type === "session.end") {
        sessionEnded = true;
        sessionResult = ev.result;
        break;
      }
      if (ev.type === "error") {
        errored = true;
        errorMessage = ev.message;
      }
    }
  } catch (err) {
    errored = true;
    errorMessage = (err as Error).message;
  }

  if (!sessionEnded && errored) {
    return { ok: false, output: assistantOutput, errorMessage };
  }
  if (sessionResult === "error") {
    return {
      ok: false,
      output: assistantOutput,
      errorMessage: errorMessage || "Session ended with error",
    };
  }
  return { ok: true, output: assistantOutput.trim() };
}

function handleAgentEvent(
  runId: string,
  stepId: string,
  attempt: number,
  ev: AgentEvent,
  appendOutput: (chunk: string) => void,
): void {
  if (ev.type === "message" && ev.role === "assistant") {
    appendOutput(`${ev.text}\n`);
    automationBus.publish({
      type: "automation.run.step.output",
      runId,
      stepId,
      attempt,
      partial: ev.text,
    });
  }
}

// Drives a run: load steps, for each step render prompt, invoke provider,
// capture output, then for review_agent parse verdict and possibly re-run the
// reviewed step (bounded by max_retries). Suspends on human_review or
// wait_for_human and returns; caller resumes via resumeRunAfterHuman.
async function executeRun(runId: string, signal: AbortSignal): Promise<void> {
  const runRow = getRunRow(runId);
  if (!runRow) {
    process.stderr.write(`[orchestrator] executeRun: missing run ${runId}\n`);
    return;
  }
  const automation = getAutomation(runRow.automation_id);
  if (!automation) {
    setRunStatus(runId, "error", {
      endedAt: new Date().toISOString(),
      error: `Automation gone: ${runRow.automation_id}`,
    });
    activeRuns.delete(runId);
    return;
  }

  setRunStatus(runId, "running");
  const steps = automation.steps;
  const stepIdByOrder = new Map<number, string>();
  for (const s of steps) stepIdByOrder.set(s.order, s.id);

  // Track per-step attempt counts (reviewed steps get bumped on REJECT).
  const attempts = new Map<string, number>();

  // Determine resume index: if context has step_<id>.output for the latest
  // completed step, skip to the next. Simpler: walk steps and skip those with
  // an existing success output.
  const currentRun = getRun(runId);
  const context: Record<string, string> = { ...(currentRun?.context ?? {}) };

  // Resume logic: if we're resuming from awaiting_human on a specific step,
  // pick up at that step. Otherwise start from index 0.
  let startIndex = 0;
  if (runRow.current_step_id) {
    const idx = steps.findIndex((s) => s.id === runRow.current_step_id);
    if (idx >= 0) {
      // If the suspended step was a human_review or had wait_for_human, and a
      // verdict came back as reject for human_review, treat this run as
      // errored. For wait_for_human or human_review with approve, advance past.
      const susp = steps[idx];
      const verdict = context[`step_${susp.id}.human_verdict`] as
        | ReviewVerdict
        | undefined;
      if (verdict === "reject") {
        const feedback = context[`step_${susp.id}.human_feedback`] ?? "";
        setRunStatus(runId, "error", {
          endedAt: new Date().toISOString(),
          error: `Human rejected step: ${feedback}`.trim(),
        });
        activeRuns.delete(runId);
        automationBus.publish({
          type: "automation.run.error",
          runId,
          message: `Human rejected step: ${feedback}`.trim(),
        });
        return;
      }
      // Approved -> resume from next step.
      startIndex = idx + 1;
    }
  }

  try {
    for (let i = startIndex; i < steps.length; i++) {
      if (signal.aborted) break;
      const step = steps[i];
      updateRun(runId, { currentStepId: step.id });

      if (step.type === "human_review") {
        // Open an awaiting_human event and suspend.
        const evt = insertEvent({
          runId,
          stepId: step.id,
          attempt: 1,
          status: "awaiting_human",
        });
        void evt;
        setRunStatus(runId, "awaiting_human", { currentStepId: step.id });
        automationBus.publish({
          type: "automation.run.awaiting_human",
          runId,
          stepId: step.id,
        });
        activeRuns.delete(runId);
        return;
      }

      if (step.type === "agent") {
        const attempt = (attempts.get(step.id) ?? 0) + 1;
        attempts.set(step.id, attempt);
        const prompt = renderTemplate(
          step.prompt ?? "",
          context,
          stepIdByOrder,
        );
        const evt = insertEvent({
          runId,
          stepId: step.id,
          attempt,
          status: "running",
        });
        automationBus.publish({
          type: "automation.run.step.started",
          runId,
          stepId: step.id,
          attempt,
        });
        const result = await runAgentStep(
          runId,
          step,
          prompt,
          attempt,
          signal,
        );
        if (!result.ok) {
          updateEvent(evt.id, {
            status: "error",
            agentOutput: result.output,
            endedAt: new Date().toISOString(),
          });
          const msg = result.errorMessage ?? "agent step failed";
          setRunStatus(runId, "error", {
            endedAt: new Date().toISOString(),
            error: msg,
          });
          automationBus.publish({
            type: "automation.run.error",
            runId,
            message: msg,
          });
          activeRuns.delete(runId);
          insertNotification(
            notificationRow({
              type: "run-complete",
              title: `Automation '${automation.name}' failed`,
              body: msg.slice(0, 240),
            }),
          );
          return;
        }
        context[`step_${step.id}.output`] = result.output;
        updateRun(runId, { context });
        updateEvent(evt.id, {
          status: "success",
          agentOutput: result.output,
          endedAt: new Date().toISOString(),
        });
        automationBus.publish({
          type: "automation.run.step.completed",
          runId,
          stepId: step.id,
          attempt,
        });

        if (step.waitForHuman) {
          // Pause for human ack before advancing.
          insertEvent({
            runId,
            stepId: step.id,
            attempt: attempt + 1,
            status: "awaiting_human",
          });
          setRunStatus(runId, "awaiting_human", { currentStepId: step.id });
          automationBus.publish({
            type: "automation.run.awaiting_human",
            runId,
            stepId: step.id,
          });
          activeRuns.delete(runId);
          return;
        }
        continue;
      }

      if (step.type === "review_agent") {
        // Review loop. Re-run the reviewed step up to max_retries on reject.
        const reviewed = step.reviewsStepId
          ? steps.find((s) => s.id === step.reviewsStepId) ?? null
          : null;
        const reviewedAttempts = reviewed
          ? attempts.get(reviewed.id) ?? 1
          : 0;
        let reviewAttempt = 0;
        let lastVerdict: ReviewVerdict | null = null;
        let lastFeedback = "";
        // We allow review_agent itself up to (reviewed.max_retries) review
        // attempts; after the last reject we force-approve and move on.
        const cap = reviewed ? reviewed.maxRetries : step.maxRetries;
        while (true) {
          if (signal.aborted) break;
          reviewAttempt += 1;
          attempts.set(step.id, reviewAttempt);
          const prompt = renderTemplate(
            step.prompt ?? "",
            context,
            stepIdByOrder,
          );
          const evt = insertEvent({
            runId,
            stepId: step.id,
            attempt: reviewAttempt,
            status: "running",
          });
          automationBus.publish({
            type: "automation.run.step.started",
            runId,
            stepId: step.id,
            attempt: reviewAttempt,
          });
          const result = await runAgentStep(
            runId,
            step,
            prompt,
            reviewAttempt,
            signal,
          );
          if (!result.ok) {
            updateEvent(evt.id, {
              status: "error",
              agentOutput: result.output,
              endedAt: new Date().toISOString(),
            });
            const msg = result.errorMessage ?? "review step failed";
            setRunStatus(runId, "error", {
              endedAt: new Date().toISOString(),
              error: msg,
            });
            automationBus.publish({
              type: "automation.run.error",
              runId,
              message: msg,
            });
            activeRuns.delete(runId);
            return;
          }
          const { verdict, feedback } = parseVerdict(result.output);
          lastVerdict = verdict;
          lastFeedback = feedback;

          if (verdict === "approve" || verdict === null) {
            // No explicit verdict -> treat as approve (we don't loop forever).
            const finalVerdict: ReviewVerdict = "approve";
            updateEvent(evt.id, {
              status: "success",
              agentOutput: result.output,
              reviewVerdict: finalVerdict,
              endedAt: new Date().toISOString(),
            });
            context[`step_${step.id}.output`] = result.output;
            updateRun(runId, { context });
            automationBus.publish({
              type: "automation.run.step.completed",
              runId,
              stepId: step.id,
              attempt: reviewAttempt,
              verdict: finalVerdict,
            });
            break;
          }

          // verdict === "reject"
          updateEvent(evt.id, {
            status: "rejected",
            agentOutput: result.output,
            reviewVerdict: "reject",
            reviewFeedback: feedback,
            endedAt: new Date().toISOString(),
          });
          automationBus.publish({
            type: "automation.run.step.completed",
            runId,
            stepId: step.id,
            attempt: reviewAttempt,
            verdict: "reject",
          });

          // Decide whether to re-run reviewed step. Cap based on reviewed step
          // attempts (each reject triggers ONE rerun, up to cap).
          if (!reviewed) {
            // No reviewed step linked -> can't loop. Force approve.
            context[`step_${step.id}.output`] = result.output;
            updateRun(runId, { context });
            break;
          }
          const reviewedAttemptsNow = attempts.get(reviewed.id) ?? 1;
          if (reviewedAttemptsNow >= cap) {
            // Force-approve after max retries.
            insertEvent({
              runId,
              stepId: step.id,
              attempt: reviewAttempt + 1,
              status: "success",
              reviewVerdict: "approve",
              agentOutput:
                "[forced approve after max retries — last feedback: " +
                lastFeedback +
                "]",
            });
            context[`step_${step.id}.output`] = result.output;
            updateRun(runId, { context });
            break;
          }

          // Re-run reviewed step with feedback in context.
          const reviewedNextAttempt = reviewedAttemptsNow + 1;
          attempts.set(reviewed.id, reviewedNextAttempt);
          context[`step_${reviewed.id}.feedback`] = feedback;
          updateRun(runId, { context });

          const rerunPrompt = renderTemplate(
            (reviewed.prompt ?? "") +
              `\n\nReviewer feedback to address:\n${feedback}`,
            context,
            stepIdByOrder,
          );
          const rerunEvt = insertEvent({
            runId,
            stepId: reviewed.id,
            attempt: reviewedNextAttempt,
            status: "running",
          });
          automationBus.publish({
            type: "automation.run.step.started",
            runId,
            stepId: reviewed.id,
            attempt: reviewedNextAttempt,
          });
          const rerun = await runAgentStep(
            runId,
            reviewed,
            rerunPrompt,
            reviewedNextAttempt,
            signal,
          );
          if (!rerun.ok) {
            updateEvent(rerunEvt.id, {
              status: "error",
              agentOutput: rerun.output,
              endedAt: new Date().toISOString(),
            });
            const msg = rerun.errorMessage ?? "rerun failed";
            setRunStatus(runId, "error", {
              endedAt: new Date().toISOString(),
              error: msg,
            });
            automationBus.publish({
              type: "automation.run.error",
              runId,
              message: msg,
            });
            activeRuns.delete(runId);
            return;
          }
          context[`step_${reviewed.id}.output`] = rerun.output;
          updateRun(runId, { context });
          updateEvent(rerunEvt.id, {
            status: "success",
            agentOutput: rerun.output,
            endedAt: new Date().toISOString(),
          });
          automationBus.publish({
            type: "automation.run.step.completed",
            runId,
            stepId: reviewed.id,
            attempt: reviewedNextAttempt,
          });
          // Loop continues — review_agent runs again next iteration.
        }

        // Mark lastVerdict for traceability (unused beyond logs).
        void lastVerdict;
        void reviewedAttempts;

        if (step.waitForHuman) {
          insertEvent({
            runId,
            stepId: step.id,
            attempt: (attempts.get(step.id) ?? 1) + 1,
            status: "awaiting_human",
          });
          setRunStatus(runId, "awaiting_human", { currentStepId: step.id });
          automationBus.publish({
            type: "automation.run.awaiting_human",
            runId,
            stepId: step.id,
          });
          activeRuns.delete(runId);
          return;
        }
        continue;
      }
    }

    if (signal.aborted) {
      // stopRun already updated the row.
      return;
    }

    // All steps done. Final output = last agent step's output (in step order).
    let finalOutput = "";
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.type === "agent" || s.type === "review_agent") {
        const v = context[`step_${s.id}.output`];
        if (v) {
          finalOutput = v;
          break;
        }
      }
    }

    setRunStatus(runId, "done", {
      endedAt: new Date().toISOString(),
      finalOutput,
      currentStepId: null,
    });
    automationBus.publish({
      type: "automation.run.done",
      runId,
      finalOutput,
    });
    insertNotification(
      notificationRow({
        type: "run-complete",
        title: `Automation '${automation.name}' done`,
        body: finalOutput.slice(0, 240),
      }),
    );
    void sendNativeNotification({
      title: `Automation done: ${automation.name}`,
      message: finalOutput.slice(0, 120) || "(no output)",
    });
  } catch (err) {
    const msg = (err as Error).message;
    setRunStatus(runId, "error", {
      endedAt: new Date().toISOString(),
      error: msg,
    });
    automationBus.publish({
      type: "automation.run.error",
      runId,
      message: msg,
    });
    insertNotification(
      notificationRow({
        type: "run-complete",
        title: `Automation '${automation.name}' errored`,
        body: msg.slice(0, 240),
      }),
    );
  } finally {
    activeRuns.delete(runId);
  }
}

// Re-export findLatestAwaitingHumanEvent so API decision route can use it without
// importing the runs repo directly.
export { findLatestAwaitingHumanEvent };

// Convenience used by templates loader to know whether an automation exists
// before the orchestrator boots a run. Not strictly needed but harmless.
export function automationLoadable(automationId: string): Automation | null {
  return getAutomation(automationId);
}
