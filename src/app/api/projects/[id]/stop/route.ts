import "server-only";

import { apiError } from "@/lib/api/errors";
import { stopRun, stopRunsForProject } from "@/lib/engine/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    let body: { sessionId?: string } = {};
    try {
      body = (await req.json()) as { sessionId?: string };
    } catch {
      // empty body is allowed
    }

    if (body.sessionId) {
      const ok = stopRun(body.sessionId);
      return Response.json({ stopped: ok ? 1 : 0 });
    }

    const n = stopRunsForProject(id);
    return Response.json({ stopped: n });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
