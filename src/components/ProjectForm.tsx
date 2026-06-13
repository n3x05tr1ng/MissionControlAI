"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  // When true (default), the bulk-import toggle is shown. Edit flows pass false.
  enableBulk?: boolean;
};

type FieldErrors = {
  name?: string;
  path?: string;
};

/* ------------------------------ inline icons ----------------------------- */

function XIcon() {
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
    >
      <path d="M4 4l8 8M12 4l-8 8" />
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

/** Legacy callers pass ALL-CAPS titles ("EDIT PROJECT"); normalize them. */
function formatTitle(raw: string): string {
  if (raw !== raw.toUpperCase()) return raw;
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint focus:border-primary/50 focus:ring-2 focus:ring-ring focus-visible:outline-none";

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const nameErrId = `${uid}-name-error`;
  const pathErrId = `${uid}-path-error`;

  useEffect(() => {
    if (mode === "single") nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      // defaultPrevented: a nested overlay (folder browser) already handled it.
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = "Project name is required.";
    if (!path.trim()) {
      errs.path = "Choose a folder for this project.";
    } else if (!path.trim().startsWith("/")) {
      errs.path = "Path must be absolute (start with /).";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errs = validate();
    setFieldErrors(errs);
    if (errs.name || errs.path) return;

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
    notify.success(
      `Added ${repos.length} project${repos.length === 1 ? "" : "s"}`,
    );
    onClose();
  }

  return (
    <div
      className="hive-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass animate-overlay flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl shadow-overlay ${
          mode === "bulk" ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-[16px] font-medium text-foreground"
            >
              {formatTitle(title)}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {mode === "bulk"
                ? "Scan a folder and import several repositories at once."
                : "Point Hive at a local folder and it becomes a project."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <XIcon />
          </button>
        </header>

        {enableBulk ? (
          <div className="border-b border-border px-5 py-3">
            <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
              <button
                type="button"
                aria-pressed={mode === "single"}
                onClick={() => setMode("single")}
                className={`rounded-sm px-3 py-1 text-[12px] font-medium ${
                  mode === "single"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Single project
              </button>
              <button
                type="button"
                aria-pressed={mode === "bulk"}
                onClick={() => setMode("bulk")}
                className={`rounded-sm px-3 py-1 text-[12px] font-medium ${
                  mode === "bulk"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bulk import
              </button>
            </div>
          </div>
        ) : null}

        {mode === "bulk" ? (
          <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
              >
                {error}
              </p>
            ) : null}
            <RepoScanner onChoose={handleBulk} />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">
                  Name
                </span>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((f) => ({ ...f, name: undefined }));
                    }
                  }}
                  placeholder="My project"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? nameErrId : undefined}
                  className={`${inputClass} ${
                    fieldErrors.name ? "border-destructive/60" : ""
                  }`}
                />
                {fieldErrors.name ? (
                  <span id={nameErrId} className="text-[12px] text-destructive">
                    {fieldErrors.name}
                  </span>
                ) : null}
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">
                  Path
                </span>
                <PathPicker
                  value={path}
                  onChange={(p) => {
                    setPath(p);
                    if (fieldErrors.path) {
                      setFieldErrors((f) => ({ ...f, path: undefined }));
                    }
                  }}
                  placeholder="/Users/me/code/my-repo"
                  rootHint="home"
                  requireGitRepo={false}
                />
                {fieldErrors.path ? (
                  <span
                    id={pathErrId}
                    role="alert"
                    className="text-[12px] text-destructive"
                  >
                    {fieldErrors.path}
                  </span>
                ) : null}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">
                  Description{" "}
                  <span className="font-normal text-faint">(optional)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What is this project about?"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-primary/50 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                />
              </label>

              <label className="flex items-start gap-2.5 rounded-md border border-border bg-surface-1 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={sandbox}
                  onChange={(e) => setSandbox(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] text-foreground">
                    Run agents in a sandbox
                  </span>
                  <span className="block text-[12px] text-faint">
                    Coming soon — stored as a flag for now.
                  </span>
                </span>
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="keycap">esc</span>
                <span className="text-[11px] text-faint">to close</span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      Saving…
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
