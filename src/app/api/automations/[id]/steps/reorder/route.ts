import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  getAutomation,
  reorderSteps,
} from "@/lib/repos/automations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
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
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const knownIds = new Set(automation.steps.map((s) => s.id));
    for (const sid of parsed.data.ids) {
      if (!knownIds.has(sid)) {
        return apiError(`Step not in automation: ${sid}`, 400);
      }
    }
    reorderSteps(id, parsed.data.ids);
    const refreshed = getAutomation(id);
    return Response.json({ ok: true, automation: refreshed });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
