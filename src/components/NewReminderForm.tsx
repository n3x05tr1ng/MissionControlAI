"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/ui/notify";

type ProjectOption = { id: string; name: string };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

type Props = {
  /**
   * Cuando es true (p. ej. al llegar con /reminders?new=1 desde el
   * CommandPalette o un EmptyState), hace scroll al formulario y enfoca
   * el campo de mensaje.
   */
  focusOnMount?: boolean;
};

function defaultDueAtLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

const inputClass =
  "rounded-md border border-input bg-background px-3 text-[13px] text-foreground transition-colors placeholder:text-faint hover:border-border-strong";

export function NewReminderForm({ focusOnMount = false }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
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
        // ignore — dropdown remains "Any project"
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ?new=1 → el form recibe focus REAL: scroll + caret en el mensaje.
  useEffect(() => {
    if (!focusOnMount) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    messageRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    // Limpia ?new=1 para que el siguiente CTA vuelva a disparar el focus.
    router.replace("/reminders", { scroll: false });
  }, [focusOnMount, router]);

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
      ref={formRef}
      id="new-reminder"
      onSubmit={onSubmit}
      className="hive-card animate-enter flex scroll-mt-20 flex-col gap-4 p-5"
    >
      <h2 className="text-[12px] font-medium text-muted-foreground">
        New reminder
      </h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">
          Message
        </span>
        <textarea
          ref={messageRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          required
          placeholder="What should we nudge you about?"
          className={`${inputClass} resize-y py-2 leading-relaxed`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            Due
          </span>
          <input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
            required
            className={`${inputClass} h-9 font-mono [color-scheme:dark]`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            Project
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={`${inputClass} h-9`}
          >
            <option value="">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status.kind === "loading" ? "Saving…" : "Add reminder"}
        </button>
        {status.kind === "error" ? (
          <span role="alert" className="font-mono text-[11px] text-destructive">
            {status.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
