"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

type Folder = {
  name: string;
  path: string;
  hasGit: boolean;
};

type BrowseResponse = {
  path: string;
  parent: string | null;
  folders: Folder[];
};

type Props = {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  rootHint?: "home" | "tmp";
  requireGitRepo?: boolean;
};

const HOME = "/Users/edwinmejia";
const TMP = "/tmp";

const QUICK_JUMPS: Array<{ label: string; path: string }> = [
  { label: "Home", path: HOME },
  { label: "Documents", path: `${HOME}/Documents` },
  { label: "Desktop", path: `${HOME}/Desktop` },
  { label: "Downloads", path: `${HOME}/Downloads` },
  { label: "tmp", path: TMP },
];

/* ------------------------------ inline icons ----------------------------- */

function FolderIcon({ className = "" }: { className?: string }) {
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
      className={className}
    >
      <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 2H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 4 4 4-4 4" />
    </svg>
  );
}

function ArrowUpIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 13V3M4 7l4-4 4 4" />
    </svg>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/* -------------------------------- trigger -------------------------------- */

export function PathPicker({
  value,
  onChange,
  placeholder = "/path/to/folder",
  rootHint = "home",
  requireGitRepo = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-label="Folder path"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-[13px] text-foreground placeholder:text-faint focus:border-primary/50 focus:ring-2 focus:ring-ring focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          <FolderIcon className="text-faint" />
          Browse
        </button>
      </div>
      {open ? (
        <BrowseModal
          initialPath={value || (rootHint === "tmp" ? TMP : HOME)}
          requireGitRepo={requireGitRepo}
          onClose={() => setOpen(false)}
          onPick={(p) => {
            onChange(p);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/* ----------------------------- folder browser ---------------------------- */

type LoadResult = {
  /** Path that was requested when this result resolved. */
  requested: string;
  data: BrowseResponse | null;
  error: string | null;
};

function BrowseModal({
  initialPath,
  requireGitRepo,
  onClose,
  onPick,
}: {
  initialPath: string;
  requireGitRepo: boolean;
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const [requested, setRequested] = useState<string>(initialPath);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  // hasGit for paths we have seen in parent listings (the API only reports
  // hasGit for children, never for the current dir itself).
  const [gitMap, setGitMap] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );

  // Fetch on navigation. All setState calls happen inside promise callbacks
  // (never synchronously in the effect body) and `loading` is derived from
  // requested !== result.requested — no set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fs/browse?path=${encodeURIComponent(requested)}&showHidden=true`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as BrowseResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setGitMap((prev) => {
          const next = new Map(prev);
          for (const f of json.folders) next.set(f.path, f.hasGit);
          return next;
        });
        setResult({ requested, data: json, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult({
          requested,
          data: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [requested]);

  const loading = result?.requested !== requested;
  const data = loading ? null : (result?.data ?? null);
  const error = loading ? null : (result?.error ?? null);
  const current = data?.path ?? requested;
  const folders = useMemo(() => data?.folders ?? [], [data]);
  const currentIsGit = gitMap.get(current) ?? false;
  const pickDisabled = requireGitRepo && !currentIsGit;

  const navigate = useCallback((p: string) => {
    setActiveIndex(-1);
    setRequested(p);
  }, []);

  // Keyboard: ↑/↓ move highlight, →/Enter open folder, ←/Backspace go up,
  // ⌘/Ctrl+Enter (or Enter with nothing highlighted) picks the current dir.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Capture + stopPropagation so a parent modal (e.g. ProjectForm)
        // doesn't also close from the same keypress.
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (loading) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, folders.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        if (data?.parent) {
          e.preventDefault();
          navigate(data.parent);
        }
        return;
      }
      if (e.key === "ArrowRight") {
        const f = folders[activeIndex];
        if (f) {
          e.preventDefault();
          navigate(f.path);
        }
        return;
      }
      if (e.key === "Enter") {
        // Let focused buttons handle their own Enter.
        if (target instanceof HTMLButtonElement) return;
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          if (!pickDisabled) onPick(current);
          return;
        }
        const f = folders[activeIndex];
        if (f) {
          navigate(f.path);
        } else if (!pickDisabled) {
          onPick(current);
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    activeIndex,
    current,
    data,
    folders,
    loading,
    navigate,
    onClose,
    onPick,
    pickDisabled,
  ]);

  // Keep the highlighted row in view (no state changes here).
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const segments = useMemo(() => buildBreadcrumb(current), [current]);

  return (
    <div
      className="hive-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select a folder"
        className="glass animate-overlay flex h-[600px] max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-medium text-foreground">
            Select a folder
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <XIcon />
          </button>
        </header>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-3 py-2"
        >
          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            return (
              <span key={seg.path} className="flex shrink-0 items-center">
                {idx > 0 ? (
                  <ChevronRightIcon className="shrink-0 text-faint" />
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(seg.path)}
                  aria-current={isLast ? "location" : undefined}
                  className={`rounded-sm px-1.5 py-0.5 font-mono text-[12px] ${
                    isLast
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {seg.label}
                </button>
              </span>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
          {QUICK_JUMPS.map((j) => (
            <button
              key={j.path}
              type="button"
              onClick={() => navigate(j.path)}
              className="h-7 rounded-full border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            >
              {j.label}
            </button>
          ))}
          {data?.parent ? (
            <button
              type="button"
              onClick={() => data.parent && navigate(data.parent)}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            >
              <ArrowUpIcon />
              Up
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <div className="flex flex-col items-start gap-3 px-4 py-4">
              <p
                role="alert"
                className="w-full rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => navigate(HOME)}
                className="h-8 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                Go to Home
              </button>
            </div>
          ) : folders.length === 0 ? (
            <div className="animate-enter flex h-full flex-col items-center justify-center gap-1 px-4 py-8 text-center">
              <FolderIcon className="mb-1 text-faint" />
              <p className="text-[13px] font-medium text-foreground">
                No subfolders here
              </p>
              <p className="text-[12px] text-muted-foreground">
                You can still pick this folder from the bar below.
              </p>
            </div>
          ) : (
            <ul ref={listRef} className="divide-y divide-border">
              {folders.map((f, idx) => {
                const dimmed = requireGitRepo && !f.hasGit;
                const active = idx === activeIndex;
                return (
                  <li
                    key={f.path}
                    className={`group flex min-h-11 items-center gap-1 pr-3 pl-4 ${
                      active ? "bg-surface-2" : "hover:bg-surface-2"
                    } ${dimmed ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(f.path)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
                    >
                      <FolderIcon className="shrink-0 text-faint" />
                      <span className="truncate text-[13px] text-foreground">
                        {f.name}
                      </span>
                      {f.hasGit ? (
                        <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] text-primary">
                          git
                        </span>
                      ) : null}
                      <ChevronRightIcon className="ml-auto shrink-0 text-faint opacity-0 group-hover:opacity-100" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onPick(f.path)}
                      disabled={requireGitRepo && !f.hasGit}
                      className="h-7 shrink-0 rounded-md border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Select
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-mono text-[12px] text-muted-foreground"
              title={current}
            >
              {current}
            </div>
            <div className="mt-1.5 hidden items-center gap-x-2 gap-y-1 sm:flex">
              <span className="keycap">↑↓</span>
              <span className="text-[11px] text-faint">navigate</span>
              <span className="keycap">↵</span>
              <span className="text-[11px] text-faint">open</span>
              <span className="keycap">⌘↵</span>
              <span className="text-[11px] text-faint">use folder</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPick(current)}
            disabled={pickDisabled}
            className="h-9 shrink-0 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use this folder
          </button>
        </footer>
      </div>
    </div>
  );
}

function ListSkeleton() {
  const widths = [46, 62, 38, 54, 70, 44, 58, 50];
  return (
    <ul className="divide-y divide-border" aria-hidden="true">
      {widths.map((w, i) => (
        <li key={i} className="flex min-h-11 items-center gap-2.5 px-4">
          <Skeleton className="h-4 w-4 rounded-xs" />
          <div style={{ width: `${w}%` }}>
            <Skeleton className="h-3.5 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function buildBreadcrumb(p: string): Array<{ label: string; path: string }> {
  const segments = p.split("/").filter(Boolean);
  const out: Array<{ label: string; path: string }> = [
    { label: "/", path: "/" },
  ];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    out.push({ label: seg, path: acc });
  }
  return out;
}
