import "server-only";

import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";

import { assertAllowedPath } from "@/lib/fs/safety";

const MAX_DIFF_BYTES = 64 * 1024;

function client(projectPath: string): SimpleGit {
  assertAllowedPath(projectPath);
  return simpleGit(projectPath);
}

export interface GitStatusFile {
  path: string;
  index: string;
  working: string;
  staged: boolean;
  isUntracked: boolean;
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
}

function fileFromStatus(
  s: StatusResult,
  entry: { path: string; index: string; working_dir: string },
): GitStatusFile {
  const isUntracked = entry.index === "?" && entry.working_dir === "?";
  const staged = !isUntracked && entry.index !== " " && entry.index !== "?";
  void s;
  return {
    path: entry.path,
    index: entry.index,
    working: entry.working_dir,
    staged,
    isUntracked,
  };
}

export async function gitStatus(projectPath: string): Promise<GitStatusResult> {
  const git = client(projectPath);
  const s = await git.status();
  return {
    branch: s.current ?? "",
    ahead: s.ahead ?? 0,
    behind: s.behind ?? 0,
    files: s.files.map((f) => fileFromStatus(s, f)),
  };
}

export interface GitBranchesResult {
  current: string;
  locals: string[];
  remotes: string[];
}

export async function gitListBranches(
  projectPath: string,
): Promise<GitBranchesResult> {
  const git = client(projectPath);
  const summary = await git.branch(["-a"]);
  const locals: string[] = [];
  const remotes: string[] = [];
  for (const name of Object.keys(summary.branches)) {
    if (name.startsWith("remotes/")) {
      remotes.push(name.replace(/^remotes\//, ""));
    } else {
      locals.push(name);
    }
  }
  return {
    current: summary.current ?? "",
    locals: locals.sort(),
    remotes: remotes.sort(),
  };
}

export interface GitCheckoutResult {
  ok: true;
  branch: string;
}

export async function gitCheckout(
  projectPath: string,
  branch: string,
): Promise<GitCheckoutResult> {
  const git = client(projectPath);
  await git.checkout(branch);
  return { ok: true, branch };
}

export async function gitCreateBranch(
  projectPath: string,
  name: string,
): Promise<GitCheckoutResult> {
  const git = client(projectPath);
  await git.checkout(["-b", name]);
  return { ok: true, branch: name };
}

export interface GitStageResult {
  ok: true;
  staged: number;
}

export async function gitStage(
  projectPath: string,
  files: string[],
): Promise<GitStageResult> {
  const git = client(projectPath);
  if (files.length === 0) return { ok: true, staged: 0 };
  await git.add(files);
  // ["."] means "all"; report best-effort count via post-status
  if (files.length === 1 && files[0] === ".") {
    const s = await git.status();
    return { ok: true, staged: s.staged.length };
  }
  return { ok: true, staged: files.length };
}

export interface GitUnstageResult {
  ok: true;
  unstaged: number;
}

export async function gitUnstage(
  projectPath: string,
  files: string[],
): Promise<GitUnstageResult> {
  const git = client(projectPath);
  if (files.length === 0) return { ok: true, unstaged: 0 };
  // `git reset HEAD -- <files>` unstages without touching working tree
  await git.reset(["HEAD", "--", ...files]);
  return { ok: true, unstaged: files.length };
}

export interface GitCommitResult {
  ok: true;
  hash: string;
}

export async function gitCommit(
  projectPath: string,
  message: string,
): Promise<GitCommitResult> {
  const git = client(projectPath);
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Commit message is required");
  }
  const res = await git.commit(trimmed);
  if (!res.commit) {
    throw new Error("Nothing to commit");
  }
  return { ok: true, hash: res.commit };
}

async function ensureHasRemote(git: SimpleGit): Promise<void> {
  const remotes = await git.getRemotes(false);
  if (remotes.length === 0) {
    throw new Error("No git remote configured");
  }
}

export interface GitPushResult {
  ok: true;
  updated: string;
}

export async function gitPush(
  projectPath: string,
  opts: { setUpstream?: boolean } = {},
): Promise<GitPushResult> {
  const git = client(projectPath);
  await ensureHasRemote(git);
  if (opts.setUpstream) {
    const status = await git.status();
    const branch = status.current ?? "";
    if (!branch) throw new Error("Detached HEAD; cannot push");
    const res = await git.push(["--set-upstream", "origin", branch]);
    return { ok: true, updated: String(res?.update?.head?.local ?? branch) };
  }
  const res = await git.push();
  return { ok: true, updated: String(res?.update?.head?.local ?? "") };
}

export interface GitPullResult {
  ok: true;
  summary: unknown;
}

export async function gitPull(
  projectPath: string,
  opts: { rebase?: boolean } = {},
): Promise<GitPullResult> {
  const git = client(projectPath);
  await ensureHasRemote(git);
  const args: string[] = [];
  if (opts.rebase) args.push("--rebase");
  const res =
    args.length > 0 ? await git.pull(undefined, undefined, args) : await git.pull();
  return { ok: true, summary: res };
}

export interface GitFetchResult {
  ok: true;
}

export async function gitFetch(projectPath: string): Promise<GitFetchResult> {
  const git = client(projectPath);
  await ensureHasRemote(git);
  await git.fetch();
  return { ok: true };
}

export interface GitLogEntry {
  hash: string;
  short: string;
  date: string;
  message: string;
  author: string;
}

export async function gitLog(
  projectPath: string,
  count = 10,
): Promise<GitLogEntry[]> {
  const git = client(projectPath);
  const max = Math.max(1, Math.min(100, Math.floor(count)));
  let log;
  try {
    log = await git.log({ maxCount: max });
  } catch {
    return [];
  }
  return log.all.map((c) => ({
    hash: c.hash,
    short: c.hash.slice(0, 7),
    date: new Date(c.date).toISOString(),
    message: c.message,
    author: c.author_name,
  }));
}

export async function gitDiff(
  projectPath: string,
  file?: string,
): Promise<string> {
  const git = client(projectPath);
  const args = file ? ["--", file] : [];
  const out = await git.diff(args);
  if (out.length > MAX_DIFF_BYTES) {
    return `${out.slice(0, MAX_DIFF_BYTES)}\n... (diff truncated at 64KB)`;
  }
  return out;
}
