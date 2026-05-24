import "server-only";

import { resolveProject, gitError } from "@/app/api/git/_helpers";
import { gitLog } from "@/lib/git/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveProject(projectId);
  if (!r.ok) return r.res;
  const url = new URL(req.url);
  const countRaw = url.searchParams.get("count");
  const count = countRaw ? Math.max(1, Math.min(100, Number(countRaw) || 10)) : 10;
  try {
    const commits = await gitLog(r.project.path, count);
    return Response.json({ ok: true, commits });
  } catch (err) {
    return gitError(err);
  }
}
