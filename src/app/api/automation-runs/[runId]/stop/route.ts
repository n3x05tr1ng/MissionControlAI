import "server-only";

import { apiError } from "@/lib/api/errors";
import { stopRun } from "@/lib/automations/orchestrator";
import { getRun } from "@/lib/repos/automationRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const run = getRun(runId);
    if (!run) return apiError("Run not found", 404);
    const ok = stopRun(runId);
    return Response.json({ ok, stopped: ok });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
