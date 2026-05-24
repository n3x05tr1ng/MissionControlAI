import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { assertAllowedPath, PathNotAllowedError } from "@/lib/fs/safety";
import { getProject } from "@/lib/repos/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const writeSchema = z.object({ json: z.string() });

function resolveStatePath(projectId: string):
  | { ok: true; filePath: string }
  | { ok: false; res: Response } {
  const project = getProject(projectId);
  if (!project) return { ok: false, res: apiError("Project not found", 404) };
  try {
    assertAllowedPath(project.path);
  } catch (err) {
    if (err instanceof PathNotAllowedError) {
      return { ok: false, res: apiError(err.message, 400) };
    }
    return { ok: false, res: apiError((err as Error).message) };
  }
  return { ok: true, filePath: join(project.path, ".claude", "state.json") };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveStatePath(projectId);
  if (!r.ok) return r.res;
  try {
    const content = await readFile(r.filePath, "utf8");
    return Response.json({ ok: true, content });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ ok: true, content: null });
    }
    return apiError((err as Error).message);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await ctx.params;
  const r = resolveStatePath(projectId);
  if (!r.ok) return r.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }

  let pretty: string;
  try {
    const obj = JSON.parse(parsed.data.json);
    pretty = `${JSON.stringify(obj, null, 2)}\n`;
  } catch (err) {
    return apiError(`Invalid JSON: ${(err as Error).message}`, 400);
  }

  try {
    await mkdir(dirname(r.filePath), { recursive: true });
    await writeFile(r.filePath, pretty, "utf8");
    return Response.json({ ok: true });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
