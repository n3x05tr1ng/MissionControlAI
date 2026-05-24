"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

type ProjectOption = { id: string; name: string };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

function defaultDueAtLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function NewReminderForm() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [dueAtLocal, setDueAtLocal] = useState<string>(defaultDueAtLocal());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as Array<{
          config: { id: string; name: string };
        }>;
        if (cancelled) return;
        setProjects(body.map((s) => ({ id: s.config.id, name: s.config.name })));
      } catch {
        // ignore — dropdown remains "(any project)"
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) {
      setStatus({ kind: "error", message: "Message required" });
      return;
    }
    const dueDate = new Date(dueAtLocal);
    if (Number.isNaN(dueDate.getTime())) {
      setStatus({ kind: "error", message: "Invalid due date" });
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || null,
          message: message.trim(),
          dueAt: dueDate.toISOString(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error ?? `HTTP ${res.status}`;
        setStatus({ kind: "error", message: msg });
        notify.error(msg);
        return;
      }
      setMessage("");
      setDueAtLocal(defaultDueAtLocal());
      setStatus({ kind: "idle" });
      notify.success("Reminder added");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setStatus({ kind: "error", message: msg });
      notify.error(msg);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-hive-border bg-hive-panel p-4 flex flex-col gap-3"
    >
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
        [ NEW REMINDER ]
      </h3>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Project
        </span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="bg-hive-bg border border-hive-border px-2 py-1 font-mono text-sm text-hive-text focus:outline-none focus:border-hive-amber"
        >
          <option value="">(any project)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Message
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          required
          className="bg-hive-bg border border-hive-border px-2 py-1 font-mono text-sm text-hive-text focus:outline-none focus:border-hive-amber"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
          Due
        </span>
        <input
          type="datetime-local"
          value={dueAtLocal}
          onChange={(e) => setDueAtLocal(e.target.value)}
          required
          className="bg-hive-bg border border-hive-border px-2 py-1 font-mono text-sm text-hive-text focus:outline-none focus:border-hive-amber"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status.kind === "loading" ? "Saving…" : "Add reminder"}
        </button>
        {status.kind === "error" ? (
          <span className="font-mono text-[11px] text-red-400">
            {status.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
