"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

export function NewProfileButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

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
        onClick={() => setShowCreate(true)}
        className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20"
      >
        + New profile
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text disabled:opacity-50"
      >
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onImportFile}
        className="hidden"
      />
      {error ? (
        <span className="font-mono text-[10px] text-red-400">{error}</span>
      ) : null}

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setShowCreate(false)}
        >
          <form
            onSubmit={createBlank}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-hive-border bg-hive-panel p-4 flex flex-col gap-3"
          >
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
              [ NEW PROFILE ]
            </h2>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
                autoFocus
              />
            </label>
            {error ? (
              <p className="text-xs text-red-400 font-mono">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={busy}
                className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
              >
                {busy ? "creating…" : "create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
