import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { TASK_STATUSES, type TaskStatus } from "@/lib/contracts";
import { getProject } from "@/lib/repos/projects";
import {
  insertTask,
  listTasks,
  nextSortOrder,
  setRecurrence,
} from "@/lib/repos/tasks";
import { isValidCron } from "@/lib/tasks/cronPresets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const statusParam = url.searchParams.get("status");

    let status: TaskStatus | undefined;
    if (statusParam) {
      if (!isTaskStatus(statusParam)) {
        return apiError(`Invalid status: ${statusParam}`, 400);
      }
      status = statusParam;
    }

    const tasks = listTasks({ projectId, status });
    return Response.json(tasks);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const createSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
  prompt: z.string().optional(),
  agentId: z.string().optional(), // deprecated, accepted for one release
  profileId: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  flags: z.record(z.string(), z.unknown()).optional(),
  schedule: z.string().nullable().optional(),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }

  const {
    projectId,
    title,
    description,
    prompt,
    agentId,
    profileId,
    status: statusInput,
    flags,
    schedule: scheduleInput,
  } = parsed.data;

  if (agentId !== undefined) {
    process.stderr.write(
      `[api.tasks] deprecation: 'agentId' is ignored; use 'profileId' instead\n`,
    );
  }

  if (!getProject(projectId)) {
    return apiError(`Project not found: ${projectId}`, 404);
  }

  const schedule =
    scheduleInput === undefined || scheduleInput === null
      ? null
      : scheduleInput.trim().length === 0
        ? null
        : scheduleInput.trim();

  if (schedule !== null && !isValidCron(schedule)) {
    return apiError(`Invalid cron expression: ${schedule}`, 400);
  }

  const status: TaskStatus = statusInput ?? "backlog";

  try {
    const row = insertTask({
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      description: description ?? null,
      prompt: prompt ?? "",
      agent_id: "claude-code",
      profile_id: profileId ?? "default",
      status,
      sort_order: nextSortOrder(status, projectId),
      flags: flags ? JSON.stringify(flags) : null,
    });
    const finalRow =
      schedule !== null ? setRecurrence(row.id, schedule) : row;
    return Response.json(finalRow, { status: 200 });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
