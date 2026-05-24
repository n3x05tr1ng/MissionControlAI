import "server-only";

import { resolveProject, gitError } from "@/app/api/git/_helpers";
import { gitFetch } from "@/lib/git/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveProject(projectId);
  if (!r.ok) return r.res;
  try {
    const data = await gitFetch(r.project.path);
    return Response.json(data);
  } catch (err) {
    return gitError(err);
  }
}
