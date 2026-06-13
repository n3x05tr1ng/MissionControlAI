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
import {
  TaskModalShell,
  btnDangerCls,
  btnPrimaryCls,
  btnSecondaryCls,
  fieldLabelCls,
  inputCls,
  selectCls,
  textareaCls,
} from "./TaskModalShell";

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

// El formulario se monta por tarea (key) y solo con el modal abierto: el
// estado se inicializa desde la tarea sin efectos de sincronización.
export function EditTaskModal({ task, open, ...rest }: Props) {
  if (!open || !task) return null;
  return <EditTaskForm key={task.id} task={task} {...rest} />;
}

function EditTaskForm({
  task,
  onClose,
  onSaved,
  onDeleted,
  projects,
}: Omit<Props, "open" | "task"> & { task: TaskRow }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [prompt, setPrompt] = useState(task.prompt);
  const [profileId, setProfileId] = useState<string>(
    task.profile_id ?? "default",
  );
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [schedule, setSchedule] = useState<string | null>(task.schedule ?? null);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles?includeTemplates=true")
      .then((r) => r.json())
      .then((data: AgentProfile[]) => {
        if (!cancelled) setProfiles(data);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projectName =
    projects.find((p) => p.id === task.project_id)?.name ?? task.project_id;
  const groups = splitProfiles(profiles);
  const selected = profiles.find((p) => p.id === profileId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
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
    <TaskModalShell title="Edit task" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <p className="font-mono text-[11px] text-faint">
          Project: {projectName}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelCls}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelCls}>Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelCls}>Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className={textareaCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelCls}>Profile</span>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={selectCls}
            >
              {profiles.length === 0 ? (
                <option value={profileId}>{profileId}</option>
              ) : (
                groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            {selected ? (
              <span
                className="font-mono text-[11px]"
                style={{ color: selected.color }}
              >
                {selected.model} · {selected.permissionMode}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelCls}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={selectCls}
            >
              <option value="backlog">Backlog</option>
              <option value="ready">Ready</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>

        <RepeatPicker value={schedule} onChange={setSchedule} />

        {error ? (
          <p role="alert" className="font-mono text-[12px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={destroy}
            disabled={busy}
            className={btnDangerCls}
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnSecondaryCls}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={btnPrimaryCls}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </TaskModalShell>
  );
}
