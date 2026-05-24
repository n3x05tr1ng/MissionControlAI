import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { loadProjectsConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { readProjectSnapshot } from "@/lib/projectReader";
import { notificationsForProject } from "@/lib/repos/notifications";
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/repos/projects";
import { listRemindersForProject } from "@/lib/repos/reminders";
import { listSessionsForProject } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const { projects } = loadProjectsConfig();
    const cfg = projects.find((p) => p.id === id);
    if (!cfg) {
      return apiError("Project not found", 404);
    }

    const snapshot = await readProjectSnapshot(cfg);
    const sessions = listSessionsForProject(id, 20);
    const reminders = listRemindersForProject(id);
    const notifications = notificationsForProject(id, 20);

    return Response.json({ snapshot, sessions, reminders, notifications });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sandbox: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const existing = getProject(id);
    if (!existing) return apiError("Project not found", 404);

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

    if (parsed.data.path !== undefined && !parsed.data.path.startsWith("/")) {
      return apiError("path must be an absolute path (start with /)", 400);
    }

    updateProject(id, parsed.data);

    const updated = getProject(id);
    if (!updated) return apiError("Project disappeared after update");
    return Response.json(updated);
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
    const existing = getProject(id);
    if (!existing) return apiError("Project not found", 404);

    const db = getDb();
    const tx = db.transaction((projectId: string) => {
      db.prepare(`DELETE FROM project_index WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM reminders WHERE project_id = ?`).run(projectId);
      deleteProject(projectId);
    });
    tx(id);

    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
