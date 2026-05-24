import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  getAutomation,
  insertStep,
} from "@/lib/repos/automations";

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
    return Response.json(automation.steps);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const createSchema = z.object({
  type: z.enum(["agent", "review_agent", "human_review"]),
  profileId: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  reviewsStepId: z.string().nullable().optional(),
  maxRetries: z.number().int().min(0).max(20).optional(),
  waitForHuman: z.boolean().optional(),
  order: z.number().int().min(1).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);

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
    const step = insertStep({
      automationId: id,
      type: input.type,
      profileId: input.profileId ?? null,
      prompt: input.prompt ?? null,
      reviewsStepId: input.reviewsStepId ?? null,
      maxRetries: input.maxRetries,
      waitForHuman: input.waitForHuman,
      order: input.order,
    });
    return Response.json({ ok: true, step });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
