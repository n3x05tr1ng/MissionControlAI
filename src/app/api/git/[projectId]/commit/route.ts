import "server-only";

import { z } from "zod";

import { resolveProject, gitError } from "@/app/api/git/_helpers";
import { apiError } from "@/lib/api/errors";
import { gitCommit } from "@/lib/git/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  message: z.string().min(1, "message is required"),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveProject(projectId);
  if (!r.ok) return r.res;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  try {
    const data = await gitCommit(r.project.path, parsed.data.message);
    return Response.json(data);
  } catch (err) {
    return gitError(err);
  }
}
