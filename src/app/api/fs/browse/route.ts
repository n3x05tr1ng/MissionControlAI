import "server-only";

import fs from "node:fs";
import path from "node:path";

import { apiError } from "@/lib/api/errors";
import {
  PathNotAllowedError,
  assertAllowedPath,
  isAllowedPath,
} from "@/lib/fs/safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAME_BLACKLIST = new Set(["node_modules", "Library"]);

type FolderEntry = {
  name: string;
  path: string;
  hasGit: boolean;
};

function hasGitMarker(dir: string): boolean {
  try {
    const gitPath = path.join(dir, ".git");
    return fs.existsSync(gitPath);
  } catch {
    return false;
  }
}

function computeParent(resolved: string): string | null {
  if (resolved === "/") return null;
  const parent = path.dirname(resolved);
  if (parent === resolved) return null;
  if (!isAllowedPath(parent)) return null;
  return parent;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawPath = url.searchParams.get("path");
    const showHidden = url.searchParams.get("showHidden") === "true";

    if (!rawPath) return apiError("path query parameter is required", 400);
    if (!rawPath.startsWith("/")) {
      return apiError("path must be absolute", 400);
    }

    try {
      assertAllowedPath(rawPath);
    } catch (err) {
      if (err instanceof PathNotAllowedError) {
        return apiError(err.message, 403);
      }
      throw err;
    }

    const resolved = path.normalize(rawPath);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return apiError(`Path not found: ${resolved}`, 404);
    }
    if (!stat.isDirectory()) {
      return apiError(`Path is not a directory: ${resolved}`, 400);
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(resolved, { withFileTypes: true });
    } catch (err) {
      return apiError((err as Error).message, 500);
    }

    const folders: FolderEntry[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (NAME_BLACKLIST.has(name)) continue;
      if (!showHidden && name.startsWith(".")) continue;
      const childPath = path.join(resolved, name);
      folders.push({
        name,
        path: childPath,
        hasGit: hasGitMarker(childPath),
      });
    }

    folders.sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      const firstLetterA = an.charAt(0);
      const firstLetterB = bn.charAt(0);
      if (firstLetterA === firstLetterB && a.hasGit !== b.hasGit) {
        return a.hasGit ? -1 : 1;
      }
      return an.localeCompare(bn);
    });

    return Response.json({
      path: resolved,
      parent: computeParent(resolved),
      folders,
    });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
