import "server-only";

import { z } from "zod";

import { resolveProject, gitError } from "@/app/api/git/_helpers";
import { apiError } from "@/lib/api/errors";
import { gitPull } from "@/lib/git/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({ rebase: z.boolean().optional() })
  .optional()
  .default({});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveProject(projectId);
  if (!r.ok) return r.res;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  try {
    const data = await gitPull(r.project.path, parsed.data ?? {});
    return Response.json(data);
  } catch (err) {
    return gitError(err);
  }
}
