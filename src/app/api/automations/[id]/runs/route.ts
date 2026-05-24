import "server-only";

import { apiError } from "@/lib/api/errors";
import { getAutomation } from "@/lib/repos/automations";
import { listRunsForAutomation } from "@/lib/repos/automationRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.max(1, Math.min(500, parseInt(limitRaw, 10) || 50)) : 50;
    const runs = listRunsForAutomation(id, limit);
    return Response.json(runs);
  } catch (err) {
    return apiError((err as Error).message);
  }
}
