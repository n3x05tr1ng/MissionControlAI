import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  deleteStep,
  getAutomation,
  updateStep,
} from "@/lib/repos/automations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  type: z.enum(["agent", "review_agent", "human_review"]).optional(),
  profileId: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  reviewsStepId: z.string().nullable().optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
  waitForHuman: z.boolean().optional(),
  order: z.number().int().min(1).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; stepId: string }> },
): Promise<Response> {
  try {
    const { id, stepId } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);
    const exists = automation.steps.find((s) => s.id === stepId);
    if (!exists) return apiError("Step not found", 404);

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
    const step = updateStep(stepId, parsed.data);
    return Response.json({ ok: true, step });
  } catch (err) {
    return apiError((err as Error).message);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; stepId: string }> },
): Promise<Response> {
  try {
    const { id, stepId } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);
    const exists = automation.steps.find((s) => s.id === stepId);
    if (!exists) return apiError("Step not found", 404);
    deleteStep(stepId);
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
