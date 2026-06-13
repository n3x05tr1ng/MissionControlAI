"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import { formatRelative } from "@/lib/time";

type Props = {
  projectId: string;
  initialBranch?: string;
};

type GitFile = {
  path: string;
  index: string;
  working: string;
  staged: boolean;
  isUntracked: boolean;
};

type StatusData = {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFile[];
};

type BranchesData = {
  current: string;
  locals: string[];
  remotes: string[];
};

type Commit = {
  hash: string;
  short: string;
  date: string;
  message: string;
  author: string;
};

type Busy =
  | null
  | "checkout"
  | "create-branch"
  | "stage"
  | "unstage"
  | "commit"
  | "push"
  | "pull"
  | "fetch";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

const secondaryBtn =
  "inline-flex h-7 items-center rounded-md border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

const primaryBtn =
  "inline-flex h-8 items-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const sectionLabel = "text-[11px] font-medium text-faint";

export function GitPanel({ projectId, initialBranch }: Props) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [branches, setBranches] = useState<BranchesData | null>(null);
  const [log, setLog] = useState<Commit[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasRemote = useMemo(
    () => (branches?.remotes.length ?? 0) > 0,
    [branches],
  );

  const refresh = useCallback(async () => {
    try {
      const [s, b, l] = await Promise.all([
        jsonOrThrow<{ ok: true } & StatusData>(
          await fetch(`/api/git/${projectId}/status`, { cache: "no-store" }),
        ),
        jsonOrThrow<{ ok: true } & BranchesData>(
          await fetch(`/api/git/${projectId}/branches`, { cache: "no-store" }),
        ),
        jsonOrThrow<{ ok: true; commits: Commit[] }>(
          await fetch(`/api/git/${projectId}/log?count=10`, {
            cache: "no-store",
          }),
        ),
      ]);
      setStatus({
        branch: s.branch,
        ahead: s.ahead,
        behind: s.behind,
        files: s.files,
      });
      setBranches({ current: b.current, locals: b.locals, remotes: b.remotes });
      setLog(l.commits);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    // Deferred initial load: keeps the effect body free of synchronous state
    // updates (react-hooks/set-state-in-effect).
    const t = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const onCheckout = useCallback(
    async (branch: string) => {
      if (!branch || branch === status?.branch) return;
      const dirty = (status?.files.length ?? 0) > 0;
      if (dirty) {
        const ok = await confirm({
          title: "Switch branch with uncommitted changes?",
          message:
            "Your working tree has changes. Switching could fail or move them. Continue?",
          confirmLabel: "Switch",
          danger: true,
        });
        if (!ok) return;
      }
      setBusy("checkout");
      try {
        await jsonOrThrow(
          await fetch(`/api/git/${projectId}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branch }),
          }),
        );
        notify.success(`Checked out ${branch}`);
        await refresh();
      } catch (err) {
        notify.error((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [projectId, refresh, status],
  );

  const onCreateBranch = useCallback(async () => {
    const name = newBranchName.trim();
    if (!name) return;
    setBusy("create-branch");
    try {
      await jsonOrThrow(
        await fetch(`/api/git/${projectId}/branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      notify.success(`Created branch ${name}`);
      setNewBranchOpen(false);
      setNewBranchName("");
      await refresh();
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [newBranchName, projectId, refresh]);

  const stageFiles = useCallback(
    async (files: string[]) => {
      if (files.length === 0) return;
      setBusy("stage");
      try {
        await jsonOrThrow(
          await fetch(`/api/git/${projectId}/stage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files }),
          }),
        );
        await refresh();
      } catch (err) {
        notify.error((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [projectId, refresh],
  );

  const unstageFiles = useCallback(
    async (files: string[]) => {
      if (files.length === 0) return;
      setBusy("unstage");
      try {
        await jsonOrThrow(
          await fetch(`/api/git/${projectId}/unstage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files }),
          }),
        );
        await refresh();
      } catch (err) {
        notify.error((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [projectId, refresh],
  );

  const onCommit = useCallback(
    async (alsoPush: boolean) => {
      const msg = commitMsg.trim();
      if (!msg) {
        notify.error("Commit message is required");
        return;
      }
      setBusy("commit");
      try {
        await jsonOrThrow(
          await fetch(`/api/git/${projectId}/commit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg }),
          }),
        );
        notify.success("Commit created");
        setCommitMsg("");
        if (alsoPush) {
          setBusy("push");
          await jsonOrThrow(
            await fetch(`/api/git/${projectId}/push`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }),
          );
          notify.success("Pushed");
        }
        await refresh();
      } catch (err) {
        notify.error((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [commitMsg, projectId, refresh],
  );

  const onSync = useCallback(
    async (kind: "pull" | "fetch" | "push") => {
      setBusy(kind);
      try {
        await jsonOrThrow(
          await fetch(`/api/git/${projectId}/${kind}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
        );
        notify.success(`${kind} done`);
        await refresh();
      } catch (err) {
        notify.error((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [projectId, refresh],
  );

  const currentBranch = status?.branch || initialBranch || "(unknown)";
  const allFilesStaged = status
    ? status.files.length > 0 && status.files.every((f) => f.staged)
    : false;

  return (
    <section className="rounded-lg border border-border bg-surface-1 shadow-bevel">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-[12px] font-medium text-muted-foreground">Git</h2>
        {status && (status.ahead > 0 || status.behind > 0) ? (
          <span className="flex items-center gap-1.5">
            {status.ahead > 0 ? (
              <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] text-success">
                ↑{status.ahead}
              </span>
            ) : null}
            {status.behind > 0 ? (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning">
                ↓{status.behind}
              </span>
            ) : null}
          </span>
        ) : null}
      </header>

      <div className="divide-y divide-border">
        {/* Branch row */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className={sectionLabel}>Branch</span>
          <select
            className="h-8 rounded-md border border-input bg-surface-2 px-2 font-mono text-[12px] text-foreground focus:outline-none disabled:opacity-50"
            value={currentBranch}
            onChange={(e) => onCheckout(e.target.value)}
            disabled={busy !== null || !branches}
            aria-label="Switch branch"
          >
            {branches?.locals.length ? (
              branches.locals.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))
            ) : (
              <option value={currentBranch}>{currentBranch}</option>
            )}
          </select>
          <button
            type="button"
            onClick={() => setNewBranchOpen(true)}
            disabled={busy !== null}
            className={secondaryBtn}
          >
            New branch
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy !== null}
            className={`ml-auto ${secondaryBtn}`}
          >
            Refresh
          </button>
        </div>

        {newBranchOpen ? (
          <div className="animate-enter flex items-center gap-2 p-4">
            <input
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Branch name"
              className="h-8 flex-1 rounded-md border border-input bg-background/60 px-2.5 font-mono text-[12px] text-foreground placeholder:text-faint focus:border-primary/50 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreateBranch();
                if (e.key === "Escape") {
                  setNewBranchOpen(false);
                  setNewBranchName("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onCreateBranch()}
              disabled={busy !== null || !newBranchName.trim()}
              className={primaryBtn}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setNewBranchOpen(false);
                setNewBranchName("");
              }}
              className={secondaryBtn}
            >
              Cancel
            </button>
          </div>
        ) : null}

        {/* Status section */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className={sectionLabel}>
              Changes
              {status ? (
                <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {status.files.length}
                </span>
              ) : null}
            </span>
            {status && status.files.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stageFiles(["."])}
                  disabled={busy !== null || allFilesStaged}
                  className={secondaryBtn}
                >
                  Stage all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    unstageFiles(
                      status.files.filter((f) => f.staged).map((f) => f.path),
                    )
                  }
                  disabled={
                    busy !== null || !status.files.some((f) => f.staged)
                  }
                  className={secondaryBtn}
                >
                  Unstage all
                </button>
              </div>
            ) : null}
          </div>

          {!status ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Loading…</p>
          ) : status.files.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Working tree clean
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
              {status.files.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 font-mono text-[12px] hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={f.staged}
                    onChange={(e) => {
                      if (e.target.checked) {
                        void stageFiles([f.path]);
                      } else {
                        void unstageFiles([f.path]);
                      }
                    }}
                    disabled={busy !== null}
                    className="accent-primary"
                    aria-label={`Stage ${f.path}`}
                  />
                  <code className="w-8 shrink-0 text-primary">
                    {f.index === " " ? "·" : f.index}
                    {f.working === " " ? "·" : f.working}
                  </code>
                  <code className="truncate text-foreground/90">{f.path}</code>
                  {f.isUntracked ? (
                    <span className="ml-auto rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info">
                      new
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Commit row */}
        <div className="flex flex-col gap-2 p-4">
          <span className={sectionLabel}>Commit</span>
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message"
            rows={2}
            className="w-full rounded-md border border-input bg-background/60 px-2.5 py-2 font-mono text-[12px] text-foreground placeholder:text-faint focus:border-primary/50 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onCommit(false)}
              disabled={busy !== null || !commitMsg.trim()}
              className={primaryBtn}
            >
              {busy === "commit" ? "Committing…" : "Commit"}
            </button>
            {hasRemote ? (
              <button
                type="button"
                onClick={() => void onCommit(true)}
                disabled={busy !== null || !commitMsg.trim()}
                className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Commit &amp; push
              </button>
            ) : null}
          </div>
        </div>

        {/* Sync row */}
        <div className="flex items-center gap-2 p-4">
          <span className={sectionLabel}>Sync</span>
          <button
            type="button"
            onClick={() => void onSync("pull")}
            disabled={busy !== null || !hasRemote}
            className={secondaryBtn}
          >
            {busy === "pull" ? "Pulling…" : "Pull"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("fetch")}
            disabled={busy !== null || !hasRemote}
            className={secondaryBtn}
          >
            {busy === "fetch" ? "Fetching…" : "Fetch"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("push")}
            disabled={busy !== null || !hasRemote}
            className={secondaryBtn}
          >
            {busy === "push" ? "Pushing…" : "Push"}
          </button>
          {!hasRemote ? (
            <span className="ml-auto text-[12px] text-faint">No remote</span>
          ) : null}
        </div>

        {/* Recent commits */}
        <div className="p-4">
          <span className={sectionLabel}>Recent commits</span>
          {log.length === 0 ? (
            <p className="mt-2 text-[13px] text-faint">—</p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
              {log.map((c) => (
                <li
                  key={c.hash}
                  className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-surface-2"
                >
                  <code className="w-14 shrink-0 font-mono text-[12px] text-primary">
                    {c.short}
                  </code>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground/90">
                      {c.message}
                    </p>
                    <p className="font-mono text-[11px] text-faint">
                      {c.author} · {formatRelative(c.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
            >
              {error}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
