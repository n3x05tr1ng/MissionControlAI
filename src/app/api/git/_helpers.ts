import "server-only";

import { apiError } from "@/lib/api/errors";
import { assertAllowedPath, PathNotAllowedError } from "@/lib/fs/safety";
import { getProject } from "@/lib/repos/projects";

export interface ResolvedProject {
  id: string;
  path: string;
}

export function resolveProject(
  id: string,
): { ok: true; project: ResolvedProject } | { ok: false; res: Response } {
  const project = getProject(id);
  if (!project) {
    return { ok: false, res: apiError("Project not found", 404) };
  }
  try {
    assertAllowedPath(project.path);
  } catch (err) {
    if (err instanceof PathNotAllowedError) {
      return { ok: false, res: apiError(err.message, 400) };
    }
    return { ok: false, res: apiError((err as Error).message) };
  }
  return { ok: true, project: { id: project.id, path: project.path } };
}

export function gitError(err: unknown): Response {
  const msg = (err as Error).message || "Git error";
  // simple-git tends to use 500-class for shell-level failures; 400 for user errors.
  return apiError(msg, 400);
}
