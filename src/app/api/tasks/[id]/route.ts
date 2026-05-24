import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { TASK_STATUSES } from "@/lib/contracts";
import { startTask } from "@/lib/tasks/orchestrator";
import {
  deleteTask,
  getTask,
  setRecurrence,
  updateTask,
} from "@/lib/repos/tasks";
import { isValidCron } from "@/lib/tasks/cronPresets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const task = getTask(id);
    if (!task) return apiError("Task not found", 404);
    return Response.json(task);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  prompt: z.string().optional(),
  agent_id: z.string().optional(),
  profile_id: z.string().optional(),
  flags: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  sort_order: z.number().optional(),
  schedule: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const existing = getTask(id);
    if (!existing) return apiError("Task not found", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const patch = parsed.data;
    const transitionsToRunning =
      patch.status === "running" &&
      (existing.status === "ready" || existing.status === "backlog");

    // Apply non-status edits first (and non-running status changes).
    const fieldPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) fieldPatch.title = patch.title;
    if (patch.description !== undefined) fieldPatch.description = patch.description;
    if (patch.prompt !== undefined) fieldPatch.prompt = patch.prompt;
    if (patch.agent_id !== undefined) fieldPatch.agent_id = patch.agent_id;
    if (patch.profile_id !== undefined) fieldPatch.profile_id = patch.profile_id;
    if (patch.flags !== undefined) {
      fieldPatch.flags = patch.flags === null ? null : JSON.stringify(patch.flags);
    }
    if (patch.sort_order !== undefined) fieldPatch.sort_order = patch.sort_order;
    if (patch.status !== undefined && !transitionsToRunning) {
      fieldPatch.status = patch.status;
    }

    if (Object.keys(fieldPatch).length > 0) {
      updateTask(id, fieldPatch);
    }

    if (patch.schedule !== undefined) {
      const nextSchedule =
        patch.schedule === null
          ? null
          : patch.schedule.trim().length === 0
            ? null
            : patch.schedule.trim();
      if (nextSchedule !== null && !isValidCron(nextSchedule)) {
        return apiError(`Invalid cron expression: ${nextSchedule}`, 400);
      }
      setRecurrence(id, nextSchedule);
    }

    if (transitionsToRunning) {
      try {
        const { sessionId } = await startTask(id);
        const task = getTask(id);
        return Response.json({ task, sessionId });
      } catch (err) {
        return apiError((err as Error).message);
      }
    }

    const task = getTask(id);
    return Response.json({ task });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const existing = getTask(id);
    if (!existing) return apiError("Task not found", 404);
    deleteTask(id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
