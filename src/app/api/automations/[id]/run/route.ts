import "server-only";

import { apiError } from "@/lib/api/errors";
import { startRun } from "@/lib/automations/orchestrator";
import { getAutomation } from "@/lib/repos/automations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const automation = getAutomation(id);
    if (!automation) return apiError("Automation not found", 404);
    const { runId } = await startRun(id, "manual");
    return Response.json({ ok: true, runId });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
