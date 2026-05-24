"use client";

import { useEffect, useState } from "react";

import { PathPicker } from "@/components/PathPicker";
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

export function RepoScanner({ onChoose }: Props) {
  const [parent, setParent] = useState("/Users/edwinmejia/Documents");
  const [repos, setRepos] = useState<SelectableRepo[]>([]);
  const [existingPaths, setExistingPaths] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

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
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function addSelected() {
    const chosen = repos
      .filter((r) => r.selected && r.editedName.trim())
      .map((r) => ({ path: r.path, name: r.editedName.trim() }));
    if (chosen.length === 0) {
      setError("Select at least one repo with a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onChoose(chosen);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
      setBusy(false);
    }
  }

  const selectedCount = repos.filter((r) => r.selected).length;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Parent folder to scan
        </span>
        <PathPicker value={parent} onChange={setParent} rootHint="home" />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={scan}
          disabled={busy || !parent}
          className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Scan for repos"}
        </button>
        {scanned ? (
          <span className="font-mono text-[11px] text-hive-muted">
            Found {repos.length} new repo{repos.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {scanned && repos.length > 0 ? (
        <div className="max-h-60 overflow-y-auto border border-hive-border bg-hive-bg">
          <ul>
            {repos.map((r, idx) => (
              <li
                key={r.path}
                className="flex items-center gap-2 border-b border-hive-border/40 px-2 py-1.5 font-mono text-xs"
              >
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) =>
                    setRepos((curr) =>
                      curr.map((c, i) =>
                        i === idx ? { ...c, selected: e.target.checked } : c,
                      ),
                    )
                  }
                  className="accent-hive-amber"
                />
                <input
                  type="text"
                  value={r.editedName}
                  onChange={(e) =>
                    setRepos((curr) =>
                      curr.map((c, i) =>
                        i === idx ? { ...c, editedName: e.target.value } : c,
                      ),
                    )
                  }
                  className="w-32 bg-transparent border border-hive-border px-1 py-0.5 font-mono text-xs text-hive-text focus:outline-none focus:border-hive-amber"
                />
                <span className="flex-1 truncate text-hive-muted" title={r.path}>
                  {r.path}
                </span>
                {r.hasClaudeDir ? (
                  <span className="border border-hive-amber/60 px-1 text-[9px] uppercase tracking-widest text-hive-amber">
                    .claude
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scanned && repos.length === 0 ? (
        <div className="font-mono text-[11px] text-hive-muted">
          No new repos under that folder (already added repos are filtered out).
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addSelected}
          disabled={busy || selectedCount === 0}
          className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Adding…" : `Add selected (${selectedCount})`}
        </button>
        {error ? (
          <span className="font-mono text-[11px] text-red-400">{error}</span>
        ) : null}
      </div>
    </div>
  );
}
