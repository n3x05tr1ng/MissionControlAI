"use client";

import { useEffect, useRef, useState } from "react";

import { PathPicker } from "@/components/PathPicker";
import { RepoScanner } from "@/components/RepoScanner";
import { notify } from "@/lib/ui/notify";

export interface ProjectFormValues {
  name: string;
  path: string;
  description: string;
  sandbox: boolean;
}

type Props = {
  title: string;
  submitLabel: string;
  initial?: Partial<ProjectFormValues>;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  // When true (default), the bulk-add toggle is shown. Edit flows pass false.
  enableBulk?: boolean;
};

export function ProjectForm({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
  enableBulk = true,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [path, setPath] = useState(initial?.path ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sandbox, setSandbox] = useState(initial?.sandbox ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "single") nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!path.trim().startsWith("/")) {
      setError("Path must be an absolute path (start with /)");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        path: path.trim(),
        description: description.trim(),
        sandbox,
      });
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
      setBusy(false);
    }
  }

  async function handleBulk(repos: Array<{ path: string; name: string }>) {
    setError(null);
    setBusy(true);
    const errors: string[] = [];
    for (const repo of repos) {
      try {
        await onSubmit({
          name: repo.name,
          path: repo.path,
          description: "",
          sandbox: false,
        });
      } catch (err) {
        errors.push(`${repo.name}: ${(err as Error).message}`);
      }
    }
    if (errors.length > 0) {
      const msg = `Some failed: ${errors.join("; ")}`;
      setError(msg);
      notify.error(msg);
      setBusy(false);
      return;
    }
    notify.success(`Added ${repos.length} project${repos.length === 1 ? "" : "s"}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 hive-modal-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-hive-border bg-hive-panel p-5 hive-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
            [ {title} ]
          </h2>
          <div className="flex items-center gap-2">
            {enableBulk ? (
              <button
                type="button"
                onClick={() =>
                  setMode((m) => (m === "single" ? "bulk" : "single"))
                }
                className="border border-hive-border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:border-hive-amber hover:text-hive-amber"
              >
                {mode === "single" ? "Bulk add" : "Single"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs text-hive-muted hover:text-hive-amber"
              aria-label="Close"
            >
              ESC
            </button>
          </div>
        </header>

        {mode === "bulk" ? (
          <RepoScanner onChoose={handleBulk} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Name
              </span>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-hive-bg border border-hive-border px-2 py-1 font-mono text-sm text-hive-text focus:outline-none focus:border-hive-amber"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Path
              </span>
              <PathPicker
                value={path}
                onChange={setPath}
                placeholder="/Users/me/code/my-repo"
                rootHint="home"
                requireGitRepo={false}
              />
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="bg-hive-bg border border-hive-border px-2 py-1 font-mono text-sm text-hive-text focus:outline-none focus:border-hive-amber"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sandbox}
                onChange={(e) => setSandbox(e.target.checked)}
                className="accent-hive-amber"
              />
              <span className="font-mono text-xs text-hive-text/80">
                Run agents in sandbox (coming later — flag only)
              </span>
            </label>

            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving…" : submitLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-hive-border bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
              >
                Cancel
              </button>
              {error ? (
                <span className="font-mono text-[11px] text-red-400">
                  {error}
                </span>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
