"use client";

import { useEffect, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import type {
  AgentProfile,
  ProjectConfig,
  TaskRow,
  TaskStatus,
} from "@/lib/contracts";

import { RepeatPicker } from "./RepeatPicker";

type Group = {
  label: string;
  options: AgentProfile[];
};

function splitProfiles(profiles: AgentProfile[]): Group[] {
  const user = profiles.filter((p) => !p.isTemplate);
  const templates = profiles.filter((p) => p.isTemplate);
  const groups: Group[] = [];
  if (user.length > 0) groups.push({ label: "Profiles", options: user });
  if (templates.length > 0) groups.push({ label: "Templates", options: templates });
  return groups;
}

type Props = {
  task: TaskRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  projects: ProjectConfig[];
};

export function EditTaskModal({
  task,
  open,
  onClose,
  onSaved,
  onDeleted,
  projects,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [profileId, setProfileId] = useState<string>("default");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [schedule, setSchedule] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPrompt(task.prompt);
    setProfileId(task.profile_id ?? "default");
    setStatus(task.status);
    setSchedule(task.schedule ?? null);
    setError(null);
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/profiles?includeTemplates=true")
      .then((r) => r.json())
      .then((data: AgentProfile[]) => setProfiles(data))
      .catch(() => setProfiles([]));
  }, [open]);

  if (!open || !task) return null;

  const projectName =
    projects.find((p) => p.id === task.project_id)?.name ?? task.project_id;
  const groups = splitProfiles(profiles);
  const selected = profiles.find((p) => p.id === profileId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          prompt,
          profile_id: profileId,
          status,
          schedule,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      notify.success("Task saved");
      onSaved();
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!task) return;
    const ok = await confirm({
      title: "Delete task",
      message: `Delete task "${task.title}"?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      notify.success("Task deleted");
      onDeleted();
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 hive-modal-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-hive-border bg-hive-panel hive-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-hive-border px-4 py-2 flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ EDIT TASK ]
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-hive-muted hover:text-hive-amber text-sm"
          >
            ✕
          </button>
        </header>
        <form onSubmit={save} className="p-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Project: {projectName}
          </p>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text font-mono"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Profile
              </span>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              >
                {profiles.length === 0 ? (
                  <option value={profileId}>{profileId}</option>
                ) : (
                  groups.map((g) => (
                    <optgroup key={g.label} label={`— ${g.label} —`}>
                      {g.options.map((p) => (
                        <option key={p.id} value={p.id}>
                          ● {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
              {selected ? (
                <span
                  className="font-mono text-[10px] mt-0.5"
                  style={{ color: selected.color }}
                >
                  {selected.model} · {selected.permissionMode}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              >
                <option value="backlog">backlog</option>
                <option value="ready">ready</option>
                <option value="review">review</option>
                <option value="done">done</option>
              </select>
            </label>
          </div>

          <RepeatPicker value={schedule} onChange={setSchedule} />

          {error ? (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          ) : null}

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={destroy}
              disabled={busy}
              className="border border-red-500/50 px-3 py-1 text-xs uppercase tracking-widest text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="border border-hive-border px-3 py-1 text-xs uppercase tracking-widest text-hive-muted hover:text-hive-text"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:opacity-50"
              >
                {busy ? "saving…" : "save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
