import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { TASK_STATUSES, type TaskRow, type TaskStatus } from "@/lib/contracts";
import { startTask } from "@/lib/tasks/orchestrator";
import { getTask, listTasks, updateTask } from "@/lib/repos/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const moveSchema = z.object({
  id: z.string().min(1),
  toStatus: z.enum(TASK_STATUSES),
  toIndex: z.number().int().min(0),
});

function computeSortOrder(
  columnRows: TaskRow[],
  toIndex: number,
): number {
  const prev = toIndex > 0 ? columnRows[toIndex - 1] : null;
  const next = toIndex < columnRows.length ? columnRows[toIndex] : null;
  const prevOrder = prev ? prev.sort_order : null;
  const nextOrder = next ? next.sort_order : null;

  if (prevOrder !== null && nextOrder !== null) {
    return (prevOrder + nextOrder) / 2;
  }
  if (prevOrder !== null) return prevOrder + 1;
  if (nextOrder !== null) return nextOrder - 1;
  return 1;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }

  const { id, toStatus, toIndex } = parsed.data;

  const existing = getTask(id);
  if (!existing) return apiError("Task not found", 404);

  // Pull the target column (scoped to this task's project) and remove the
  // moving task so we compute a slot in the post-move ordering.
  const columnRows = listTasks({
    projectId: existing.project_id,
    status: toStatus,
  }).filter((t) => t.id !== id);

  const newOrder = computeSortOrder(columnRows, toIndex);

  const transitionsToRunning =
    toStatus === "running" &&
    (existing.status === "ready" || existing.status === "backlog");

  if (transitionsToRunning) {
    // Update sort_order first, then let startTask flip status to running.
    updateTask(id, { sort_order: newOrder });
    try {
      const { sessionId } = await startTask(id);
      const task = getTask(id);
      return Response.json({ task, sessionId });
    } catch (err) {
      return apiError((err as Error).message);
    }
  }

  const task = updateTask(id, {
    status: toStatus as TaskStatus,
    sort_order: newOrder,
  });
  return Response.json({ task });
}
