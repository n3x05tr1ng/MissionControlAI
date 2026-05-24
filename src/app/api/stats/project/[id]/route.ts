import "server-only";

import { apiError } from "@/lib/api/errors";
import { projectActivity } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const runs14d = projectActivity(id, 14);
    const totalRuns = runs14d.reduce((acc, r) => acc + r.runs, 0);
    const totalTokens = runs14d.reduce((acc, r) => acc + r.tokens, 0);
    return Response.json({ runs14d, totalRuns, totalTokens });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
