import "server-only";

import fs from "node:fs";
import path from "node:path";

import { apiError } from "@/lib/api/errors";
import { PathNotAllowedError, assertAllowedPath } from "@/lib/fs/safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "target",
  "vendor",
  "Library",
]);

type Repo = {
  path: string;
  name: string;
  hasClaudeDir: boolean;
  isWorktreeOrBare: boolean;
};

function detectRepo(dir: string): Repo | null {
  const gitPath = path.join(dir, ".git");
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(gitPath);
  } catch {
    return null;
  }

  // A regular repo has .git as a directory. A worktree or submodule uses a .git file.
  const isWorktreeOrBare = !stat.isDirectory();
  const hasClaudeDir = fs.existsSync(path.join(dir, ".claude"));

  return {
    path: dir,
    name: path.basename(dir),
    hasClaudeDir,
    isWorktreeOrBare,
  };
}

function walk(dir: string, depth: number, maxDepth: number, repos: Repo[]): void {
  const repo = detectRepo(dir);
  if (repo) {
    repos.push(repo);
    // Don't descend into a repo's own tree — repos within repos are rare and noisy.
    return;
  }

  if (depth >= maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (SKIP_DIRS.has(name)) continue;
    if (name.startsWith(".")) continue;
    const childPath = path.join(dir, name);
    walk(childPath, depth + 1, maxDepth, repos);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const root = url.searchParams.get("root");
    const depthParam = url.searchParams.get("depth");
    const maxDepth = Math.min(
      Math.max(parseInt(depthParam ?? "2", 10) || 2, 1),
      4,
    );

    if (!root) return apiError("root query parameter is required", 400);
    if (!root.startsWith("/")) return apiError("root must be absolute", 400);

    try {
      assertAllowedPath(root);
    } catch (err) {
      if (err instanceof PathNotAllowedError) {
        return apiError(err.message, 403);
      }
      throw err;
    }

    const resolved = path.normalize(root);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return apiError(`Path not found: ${resolved}`, 404);
    }
    if (!stat.isDirectory()) {
      return apiError(`Root is not a directory: ${resolved}`, 400);
    }

    const repos: Repo[] = [];
    walk(resolved, 0, maxDepth, repos);

    repos.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return Response.json({ root: resolved, repos });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
