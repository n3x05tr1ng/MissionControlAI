import "server-only";

import fs from "node:fs";
import path from "node:path";

const ALLOWED_ROOTS = ["/Users/edwinmejia", "/tmp"] as const;

function withinRoot(resolved: string): boolean {
  return ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(`${root}/`),
  );
}

export function isAllowedPath(p: string): boolean {
  if (typeof p !== "string" || p.length === 0) return false;
  if (!p.startsWith("/")) return false;

  const normalized = path.normalize(p);
  if (normalized.includes("..")) return false;
  if (!withinRoot(normalized)) return false;

  try {
    const real = fs.realpathSync(normalized);
    if (!withinRoot(real)) return false;
  } catch {
    // Path may not exist yet; the normalized check above is sufficient
    // when the directory has not been created. Existence is enforced by callers.
  }

  return true;
}

export function assertAllowedPath(p: string): void {
  if (!isAllowedPath(p)) {
    throw new PathNotAllowedError(p);
  }
}

export class PathNotAllowedError extends Error {
  constructor(p: string) {
    super(`Path not allowed: ${p}`);
    this.name = "PathNotAllowedError";
  }
}
