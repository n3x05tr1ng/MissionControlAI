"use client";

import { useEffect, useId, useState } from "react";

import { PathPicker } from "@/components/PathPicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { notify } from "@/lib/ui/notify";
import type { ProjectConfig } from "@/lib/contracts";

type ScannedRepo = {
  path: string;
  name: string;
  hasClaudeDir: boolean;
  isWorktreeOrBare: boolean;
};

type ScanResponse = {
  root: string;
  repos: ScannedRepo[];
};

type SelectableRepo = ScannedRepo & {
  selected: boolean;
  editedName: string;
};

type Props = {
  onChoose: (
    repos: Array<{ path: string; name: string }>,
  ) => Promise<void> | void;
};

/* ------------------------------ inline icons ----------------------------- */

function RadarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" />
      <path d="m11 11 3 3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mono-line "folder + magnifier" empty illustration (system style). */
function NoReposIllustration() {
  return (
    <svg
      width="120"
      height="84"
      viewBox="0 0 120 84"
      fill="none"
      aria-hidden="true"
      className="text-faint"
    >
      <circle
        cx="60"
        cy="42"
        r="36"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
        strokeDasharray="4 6"
      />
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M42 32h12l4 5h20a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H42a3 3 0 0 1-3-3V35a3 3 0 0 1 3-3z" />
        <circle cx="72" cy="46" r="7" />
        <path d="m77 51 6 6" />
      </g>
      <g
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform="translate(88 24)"
      >
        <path d="M0 -5V-1.5M0 1.5V5M-5 0H-1.5M1.5 0H5" />
      </g>
    </svg>
  );
}

/* -------------------------------- component ------------------------------ */

export function RepoScanner({ onChoose }: Props) {
  const [parent, setParent] = useState("/Users/edwinmejia/Documents");
  const [repos, setRepos] = useState<SelectableRepo[]>([]);
  const [existingPaths, setExistingPaths] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const uid = useId();

  useEffect(() => {
    let cancelled = false;
    async function loadExisting() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const list = (await res.json()) as ProjectConfig[];
        if (cancelled) return;
        setExistingPaths(new Set(list.map((p) => p.path)));
      } catch {
        // Non-fatal — dedupe is best-effort.
      }
    }
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, []);

  async function scan() {
    setScanning(true);
    setError(null);
    setScanned(false);
    try {
      const res = await fetch(
        `/api/fs/scan?root=${encodeURIComponent(parent)}&depth=2`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ScanResponse;
      const filtered = json.repos
        .filter((r) => !existingPaths.has(r.path))
        .map<SelectableRepo>((r) => ({
          ...r,
          selected: true,
          editedName: r.name,
        }));
      setRepos(filtered);
      setScanned(true);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setScanning(false);
    }
  }

  async function addSelected() {
    const chosen = repos
      .filter((r) => r.selected && r.editedName.trim())
      .map((r) => ({ path: r.path, name: r.editedName.trim() }));
    if (chosen.length === 0) {
      setError("Select at least one repository with a name.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await onChoose(chosen);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
      setAdding(false);
    }
  }

  function setAll(selected: boolean) {
    setRepos((curr) => curr.map((c) => ({ ...c, selected })));
  }

  const selectedCount = repos.filter((r) => r.selected).length;
  const hasResults = scanned && repos.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">
          Folder to scan
        </span>
        <PathPicker value={parent} onChange={setParent} rootHint="home" />
        <span className="text-[12px] text-faint">
          Scans two levels deep for git repositories. Repos already in Hive are
          skipped.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={scan}
          disabled={scanning || adding || !parent}
          className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            hasResults
              ? "border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
          }`}
        >
          {scanning ? (
            <>
              <Spinner />
              Scanning…
            </>
          ) : (
            <>
              <RadarIcon />
              {hasResults ? "Scan again" : "Scan for repos"}
            </>
          )}
        </button>
        {scanned && !scanning ? (
          <span
            className="text-[12px] text-muted-foreground"
            aria-live="polite"
          >
            Found {repos.length} new{" "}
            {repos.length === 1 ? "repository" : "repositories"}
          </span>
        ) : null}
      </div>

      {scanning ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5 shadow-bevel">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="ai-pulse absolute h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="truncate font-mono text-[12px] text-muted-foreground">
              Scanning {parent}…
            </span>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-3 shadow-bevel"
              style={{ opacity: 1 - i * 0.22 }}
            >
              <Skeleton className="h-4 w-4 rounded-xs" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-32" />
                <div className="mt-1.5">
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {hasResults && !scanning ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">
              {selectedCount} of {repos.length} selected
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAll(true)}
                className="rounded-sm px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setAll(false)}
                className="rounded-sm px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="stagger-children flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {repos.map((r, idx) => {
              const cbId = `${uid}-repo-${idx}`;
              return (
                <li
                  key={r.path}
                  className={`rounded-lg border p-3 shadow-bevel transition-colors ${
                    r.selected
                      ? "border-primary/50 bg-primary-soft"
                      : "border-border bg-surface-1 hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={cbId}
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) =>
                        setRepos((curr) =>
                          curr.map((c, i) =>
                            i === idx
                              ? { ...c, selected: e.target.checked }
                              : c,
                          ),
                        )
                      }
                      aria-label={`Include ${r.editedName || r.name}`}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={r.editedName}
                          onChange={(e) =>
                            setRepos((curr) =>
                              curr.map((c, i) =>
                                i === idx
                                  ? { ...c, editedName: e.target.value }
                                  : c,
                              ),
                            )
                          }
                          aria-label="Project name"
                          className="h-7 w-44 rounded-sm border border-input bg-background/60 px-2 font-mono text-[12px] text-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                        />
                        {r.hasClaudeDir ? (
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">
                            .claude
                          </span>
                        ) : null}
                        {r.isWorktreeOrBare ? (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[10px] text-warning">
                            worktree
                          </span>
                        ) : null}
                      </div>
                      <label
                        htmlFor={cbId}
                        title={r.path}
                        className="mt-1.5 block cursor-pointer truncate font-mono text-[11px] text-faint"
                      >
                        {r.path}
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {scanned && !scanning && repos.length === 0 ? (
        <div className="animate-enter flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-1 px-4 py-8 text-center shadow-bevel">
          <NoReposIllustration />
          <p className="mt-1 text-[13px] font-medium text-foreground">
            No new repositories found
          </p>
          <p className="max-w-[42ch] text-[12px] text-muted-foreground">
            Everything under this folder is already in Hive, or there are no
            git repos two levels deep. Try another folder.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </p>
      ) : null}

      {hasResults && !scanning ? (
        <div className="flex items-center justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={addSelected}
            disabled={adding || selectedCount === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? (
              <>
                <Spinner />
                Adding…
              </>
            ) : (
              `Add ${selectedCount} ${selectedCount === 1 ? "project" : "projects"}`
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
