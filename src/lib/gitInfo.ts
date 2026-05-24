import "server-only";

import { simpleGit } from "simple-git";

import type { GitInfo } from "@/lib/contracts";

export async function getGitInfo(projectPath: string): Promise<GitInfo | null> {
  try {
    const git = simpleGit(projectPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    const status = await git.status();
    const branch = status.current ?? "";
    const dirty =
      status.modified.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.not_added.length > 0 ||
      status.renamed.length > 0 ||
      status.staged.length > 0 ||
      status.conflicted.length > 0;

    let lastCommit: GitInfo["lastCommit"] = null;
    try {
      const log = await git.log({ maxCount: 1 });
      if (log.latest) {
        lastCommit = {
          hash: log.latest.hash.slice(0, 7),
          message: log.latest.message,
          date: new Date(log.latest.date).toISOString(),
        };
      }
    } catch {
      lastCommit = null;
    }

    return { branch, dirty, lastCommit };
  } catch {
    return null;
  }
}
