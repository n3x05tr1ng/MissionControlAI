import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { loadProjectsConfig } from "@/lib/config";
import type { ReminderRow } from "@/lib/contracts";
import { insertReminder, listPendingReminders } from "@/lib/repos/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const postBodySchema = z.object({
  projectId: z.string().min(1).nullable(),
  message: z.string().min(1),
  dueAt: z.string().min(1),
});

export async function GET(): Promise<Response> {
  try {
    const reminders = listPendingReminders();
    const { projects } = loadProjectsConfig();
    const nameById = new Map<string, string>();
    for (const p of projects) nameById.set(p.id, p.name);

    const enriched: Array<ReminderRow & { projectName: string | null }> =
      reminders.map((r) => ({
        ...r,
        projectName: r.project_id ? (nameById.get(r.project_id) ?? null) : null,
      }));

    return Response.json(enriched);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = postBodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(`Invalid body: ${parsed.error.message}`, 400);
    }

    const { projectId, message, dueAt } = parsed.data;
    const dueMs = Date.parse(dueAt);
    if (Number.isNaN(dueMs)) {
      return apiError("Invalid dueAt — must be ISO datetime", 400);
    }

    if (projectId) {
      const { projects } = loadProjectsConfig();
      if (!projects.some((p) => p.id === projectId)) {
        return apiError(`Unknown projectId: ${projectId}`, 400);
      }
    }

    const row: ReminderRow = {
      id: crypto.randomUUID(),
      project_id: projectId,
      message,
      due_at: new Date(dueMs).toISOString(),
      kind: "manual",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    insertReminder(row);
    return Response.json(row);
  } catch (err) {
    return apiError((err as Error).message);
  }
}
