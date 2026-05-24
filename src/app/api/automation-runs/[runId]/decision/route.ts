import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { getRun, setHumanReviewDecision } from "@/lib/repos/automationRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  verdict: z.enum(["approve", "reject"]),
  feedback: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const run = getRun(runId);
    if (!run) return apiError("Run not found", 404);
    if (run.status !== "awaiting_human") {
      return apiError(`Run is not awaiting human (status=${run.status})`, 409);
    }

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
    const { verdict, feedback } = parsed.data;

    const { event } = await setHumanReviewDecision(runId, verdict, feedback);
    return Response.json({ ok: true, event });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
