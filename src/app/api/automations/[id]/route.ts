import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  deleteAutomation,
  getAutomation,
  setSchedule,
  updateAutomation,
} from "@/lib/repos/automations";
import { isValidCron } from "@/lib/tasks/cronPresets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);
    return Response.json(automation);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  enabled: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  schedule: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const existing = getAutomation(id);
    if (!existing) return apiError("Automation not found", 404);

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

    if (patch.schedule !== undefined) {
      const next =
        patch.schedule === null
          ? null
          : patch.schedule.trim().length === 0
            ? null
            : patch.schedule.trim();
      if (next !== null && !isValidCron(next)) {
        return apiError(`Invalid cron expression: ${next}`, 400);
      }
      setSchedule(id, next);
    }

    const hasOtherFields =
      patch.name !== undefined ||
      patch.description !== undefined ||
      patch.color !== undefined ||
      patch.icon !== undefined ||
      patch.enabled !== undefined ||
      patch.isTemplate !== undefined;

    if (hasOtherFields) {
      updateAutomation(id, {
        name: patch.name,
        description: patch.description,
        color: patch.color,
        icon: patch.icon,
        enabled: patch.enabled,
        isTemplate: patch.isTemplate,
      });
    }

    const automation = getAutomation(id);
    return Response.json({ ok: true, automation });
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
    const existing = getAutomation(id);
    if (!existing) return apiError("Automation not found", 404);
    deleteAutomation(id);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
