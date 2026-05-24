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
    void refresh();
  }, [refresh]);

  const onCheckout = useCallback(
    async (branch: string) => {
      if (!branch || branch === status?.branch) return;
      const dirty = (status?.files.length ?? 0) > 0;
      if (dirty) {
        const ok = await confirm({
          title: "SWITCH BRANCH WITH UNCOMMITTED CHANGES",
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
    <section className="border border-hive-border bg-hive-panel">
      <header className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ GIT ]
        </h2>
        {status ? (
          <span className="font-mono text-[10px] text-hive-muted">
            {status.ahead > 0 ? `↑${status.ahead}` : null}
            {status.behind > 0 ? ` ↓${status.behind}` : null}
          </span>
        ) : null}
      </header>

      <div className="divide-y divide-hive-border">
        {/* Branch row */}
        <div className="p-4 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            branch
          </span>
          <select
            className="border border-hive-border bg-hive-panel px-2 py-1 font-mono text-xs text-hive-text"
            value={currentBranch}
            onChange={(e) => onCheckout(e.target.value)}
            disabled={busy !== null || !branches}
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
            className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
          >
            + branch
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy !== null}
            className="ml-auto border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text"
          >
            refresh
          </button>
        </div>

        {newBranchOpen ? (
          <div className="p-4 flex items-center gap-2">
            <input
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="branch name"
              className="flex-1 border border-hive-border bg-black/30 px-2 py-1 font-mono text-xs text-hive-text"
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
              className="border border-hive-amber bg-hive-amber/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
            >
              create
            </button>
            <button
              type="button"
              onClick={() => {
                setNewBranchOpen(false);
                setNewBranchName("");
              }}
              className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text"
            >
              cancel
            </button>
          </div>
        ) : null}

        {/* Status section */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              status
              {status ? ` — ${status.files.length} changes` : ""}
            </span>
            {status && status.files.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stageFiles(["."])}
                  disabled={busy !== null || allFilesStaged}
                  className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber disabled:opacity-40"
                >
                  stage all
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
                  className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text disabled:opacity-40"
                >
                  unstage all
                </button>
              </div>
            ) : null}
          </div>

          {!status ? (
            <p className="mt-2 font-mono text-xs text-hive-muted">loading…</p>
          ) : status.files.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-hive-muted">
              working tree clean
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-hive-border/50 border border-hive-border/50">
              {status.files.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-2 px-2 py-1 font-mono text-xs"
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
                    aria-label={`stage ${f.path}`}
                  />
                  <code className="text-hive-amber w-10 shrink-0">
                    {f.index === " " ? "·" : f.index}
                    {f.working === " " ? "·" : f.working}
                  </code>
                  <code className="truncate text-hive-text/90">{f.path}</code>
                  {f.isUntracked ? (
                    <span className="ml-auto text-[10px] uppercase text-hive-muted">
                      new
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Commit row */}
        <div className="p-4 flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            commit
          </span>
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message"
            rows={2}
            className="w-full border border-hive-border bg-black/30 px-2 py-1 font-mono text-xs text-hive-text"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onCommit(false)}
              disabled={busy !== null || !commitMsg.trim()}
              className="border border-hive-amber bg-hive-amber/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
            >
              {busy === "commit" ? "committing…" : "commit"}
            </button>
            {hasRemote ? (
              <button
                type="button"
                onClick={() => void onCommit(true)}
                disabled={busy !== null || !commitMsg.trim()}
                className="border border-hive-amber bg-hive-amber/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
              >
                commit & push
              </button>
            ) : null}
          </div>
        </div>

        {/* Sync row */}
        <div className="p-4 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            sync
          </span>
          <button
            type="button"
            onClick={() => void onSync("pull")}
            disabled={busy !== null || !hasRemote}
            className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber disabled:opacity-40"
          >
            {busy === "pull" ? "pulling…" : "pull"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("fetch")}
            disabled={busy !== null || !hasRemote}
            className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber disabled:opacity-40"
          >
            {busy === "fetch" ? "fetching…" : "fetch"}
          </button>
          <button
            type="button"
            onClick={() => void onSync("push")}
            disabled={busy !== null || !hasRemote}
            className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-amber disabled:opacity-40"
          >
            {busy === "push" ? "pushing…" : "push"}
          </button>
          {!hasRemote ? (
            <span className="ml-auto font-mono text-[10px] text-hive-muted">
              no remote
            </span>
          ) : null}
        </div>

        {/* Recent commits */}
        <div className="p-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            recent commits
          </span>
          {log.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-hive-muted">—</p>
          ) : (
            <ul className="mt-2 divide-y divide-hive-border/50 border border-hive-border/50">
              {log.map((c) => (
                <li
                  key={c.hash}
                  className="flex items-start gap-2 px-2 py-1 font-mono text-xs"
                >
                  <code className="text-hive-amber w-14 shrink-0">{c.short}</code>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-hive-text/90">{c.message}</p>
                    <p className="text-[10px] text-hive-muted">
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
            <p className="font-mono text-xs text-red-400">{error}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
