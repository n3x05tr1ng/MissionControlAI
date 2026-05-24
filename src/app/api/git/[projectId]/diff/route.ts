import "server-only";

import { resolveProject, gitError } from "@/app/api/git/_helpers";
import { gitDiff } from "@/lib/git/ops";

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
  const file = url.searchParams.get("file") || undefined;
  try {
    const diff = await gitDiff(r.project.path, file);
    return Response.json({ ok: true, diff });
  } catch (err) {
    return gitError(err);
  }
}
