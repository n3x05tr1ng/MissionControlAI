"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function PathPicker({
  value,
  onChange,
  placeholder = "(no folder selected)",
  rootHint = "home",
  requireGitRepo = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-stretch gap-2">
        <div
          className="flex-1 truncate border border-hive-border bg-hive-bg px-2 py-1 font-mono text-sm text-hive-text"
          title={value || placeholder}
        >
          {value || (
            <span className="text-hive-muted">{placeholder}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10"
        >
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
  const [current, setCurrent] = useState<string>(initialPath);
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fs/browse?path=${encodeURIComponent(p)}&showHidden=true`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as BrowseResponse;
      setData(json);
      setCurrent(json.path);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialPath);
  }, [initialPath, load]);

  const currentIsGit = useMemo(() => {
    if (!data) return false;
    // We don't have hasGit for the current dir from the API; infer from parent listing.
    return false;
  }, [data]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        if (!requireGitRepo) onPick(current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onClose, onPick, requireGitRepo]);

  const segments = useMemo(() => buildBreadcrumb(current), [current]);
  const useDisabled = requireGitRepo && !currentIsGit;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[600px] max-h-[90vh] w-full max-w-2xl flex-col border border-hive-border bg-hive-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hive-border px-4 py-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            [ Pick a folder ]
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-hive-muted hover:text-hive-amber"
          >
            ESC
          </button>
        </header>

        <div className="border-b border-hive-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-1 font-mono text-xs text-hive-text">
            {segments.map((seg, idx) => (
              <span key={seg.path} className="flex items-center gap-1">
                {idx > 0 ? (
                  <span className="text-hive-muted">/</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => load(seg.path)}
                  className="hover:text-hive-amber"
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-hive-border px-4 py-2">
          {QUICK_JUMPS.map((j) => (
            <button
              key={j.path}
              type="button"
              onClick={() => load(j.path)}
              className="border border-hive-border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:border-hive-amber hover:text-hive-amber"
            >
              {j.label}
            </button>
          ))}
          {data?.parent ? (
            <button
              type="button"
              onClick={() => data.parent && load(data.parent)}
              className="ml-auto border border-hive-border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:border-hive-amber hover:text-hive-amber"
            >
              .. Up
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <div className="px-4 py-3 font-mono text-xs text-red-400">{error}</div>
          ) : data && data.folders.length === 0 ? (
            <div className="px-4 py-3 font-mono text-xs text-hive-muted">
              (empty)
            </div>
          ) : (
            <ul>
              {data?.folders.map((f) => {
                const dim = requireGitRepo && !f.hasGit;
                return (
                  <li
                    key={f.path}
                    className={`flex items-center justify-between border-b border-hive-border/40 px-4 py-1.5 font-mono text-xs ${
                      dim ? "opacity-50" : ""
                    } hover:bg-hive-amber/5`}
                  >
                    <button
                      type="button"
                      onClick={() => load(f.path)}
                      className="flex flex-1 items-center gap-2 text-left text-hive-text hover:text-hive-amber"
                    >
                      <span className="text-hive-muted">[D]</span>
                      <span>{f.name}</span>
                      {f.hasGit ? (
                        <span className="ml-1 border border-hive-amber/60 px-1 text-[9px] uppercase tracking-widest text-hive-amber">
                          git
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPick(f.path)}
                      disabled={requireGitRepo && !f.hasGit}
                      className="ml-2 border border-hive-border bg-transparent px-2 py-0.5 text-[10px] uppercase tracking-widest text-hive-muted hover:border-hive-amber hover:text-hive-amber disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Select
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-hive-border px-4 py-2">
          <div className="truncate font-mono text-[11px] text-hive-muted" title={current}>
            {current}
          </div>
          <button
            type="button"
            onClick={() => onPick(current)}
            disabled={useDisabled}
            className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use this folder
          </button>
        </footer>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="px-4 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="my-1 h-5 animate-pulse bg-hive-border/40"
          style={{ width: `${40 + ((i * 13) % 50)}%` }}
        />
      ))}
    </ul>
  );
}

function buildBreadcrumb(p: string): Array<{ label: string; path: string }> {
  const segments = p.split("/").filter(Boolean);
  const out: Array<{ label: string; path: string }> = [{ label: "/", path: "/" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    out.push({ label: seg, path: acc });
  }
  return out;
}
