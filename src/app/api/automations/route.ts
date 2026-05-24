import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  insertAutomation,
  listAutomations,
  setSchedule,
} from "@/lib/repos/automations";
import { isValidCron } from "@/lib/tasks/cronPresets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(listAutomations({ includeTemplates: true }));
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const createSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  schedule: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
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
  const input = parsed.data;

  const schedule =
    input.schedule == null
      ? null
      : input.schedule.trim().length === 0
        ? null
        : input.schedule.trim();
  if (schedule !== null && !isValidCron(schedule)) {
    return apiError(`Invalid cron expression: ${schedule}`, 400);
  }

  try {
    const automation = insertAutomation({
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon,
      schedule,
      enabled: input.enabled,
      isTemplate: input.isTemplate,
    });
    // setSchedule was effectively run inside insertAutomation already; keep
    // this in case the caller passed something not handled by insert (no-op).
    if (schedule !== null) {
      setSchedule(automation.id, schedule);
    }
    return Response.json({ ok: true, automation });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
