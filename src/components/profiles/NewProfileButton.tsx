"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:opacity-50";
const secondaryBtn =
  "inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50";

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

type Props = {
  /** Abre el diálogo de creación al llegar con /profiles?new=1 (modalBus). */
  autoOpenCreate?: boolean;
};

export function NewProfileButton({ autoOpenCreate = false }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(autoOpenCreate);
  const [name, setName] = useState("");

  // Sincroniza el deep-link ?new=1 durante el render (patrón "derive state
  // from props"), evitando setState dentro de un efecto.
  const [prevAutoOpen, setPrevAutoOpen] = useState(autoOpenCreate);
  if (autoOpenCreate !== prevAutoOpen) {
    setPrevAutoOpen(autoOpenCreate);
    if (autoOpenCreate) setShowCreate(true);
  }

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setName("");
    setError(null);
    // Limpia el deep-link ?new=1 para que recargar no re-abra el diálogo.
    if (autoOpenCreate) router.replace("/profiles", { scroll: false });
  }, [autoOpenCreate, router]);

  useEffect(() => {
    if (!showCreate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeCreate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreate, busy, closeCreate]);

  async function createBlank(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      const created = (await res.json()) as { id: string };
      notify.success("Profile created");
      router.push(`/profiles/${created.id}`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      notify.success("Profile imported");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className={secondaryBtn}
      >
        Import
      </button>
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className={primaryBtn}
      >
        <PlusIcon />
        New profile
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onImportFile}
        className="hidden"
      />
      {error && !showCreate ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}

      {showCreate ? (
        <div
          className="hive-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          onClick={() => !busy && closeCreate()}
        >
          <form
            onSubmit={createBlank}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-profile-title"
            className="glass animate-overlay flex w-full max-w-md flex-col gap-4 rounded-xl p-5 shadow-overlay"
          >
            <div className="flex flex-col gap-1">
              <h2
                id="new-profile-title"
                className="text-[15px] font-semibold text-foreground"
              >
                New profile
              </h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Name it now — you can shape the prompt, model, tools and
                permissions in the editor.
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="e.g. Code reviewer"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint"
                autoFocus
              />
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeCreate}
                disabled={busy}
                className="h-8 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-8 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create profile"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
