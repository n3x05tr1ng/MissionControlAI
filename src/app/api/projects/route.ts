import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import type { ProjectConfig } from "@/lib/contracts";
import { readAllSnapshots } from "@/lib/projectReader";
import { getProject, insertProject } from "@/lib/repos/projects";
import { compareByStatus } from "@/lib/statusOrder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const snapshots = await readAllSnapshots();
    const sorted = [...snapshots].sort(compareByStatus);
    return Response.json(sorted);
  } catch (err) {
    return apiError((err as Error).message);
  }
}

const createSchema = z.object({
  name: z.string().min(1, "name is required"),
  path: z.string().min(1, "path is required"),
  description: z.string().optional(),
  sandbox: z.boolean().optional(),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "project";
}

function uniqueId(base: string): string {
  if (!getProject(base)) return base;
  let n = 2;
  while (getProject(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }

  const { name, path, description, sandbox } = parsed.data;

  if (!path.startsWith("/")) {
    return apiError("path must be a non-empty absolute path (start with /)", 400);
  }

  const id = uniqueId(slugify(name));

  try {
    insertProject({
      id,
      name,
      path,
      description,
      sandbox: sandbox ? 1 : 0,
    });
  } catch (err) {
    return apiError((err as Error).message);
  }

  const created = getProject(id);
  if (!created) return apiError("Failed to create project");

  const result: ProjectConfig = created;
  return Response.json(result, { status: 200 });
}
