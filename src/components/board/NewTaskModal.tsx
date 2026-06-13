"use client";

import { useEffect, useState } from "react";

import { notify } from "@/lib/ui/notify";
import type { AgentProfile, ProjectConfig, TaskStatus } from "@/lib/contracts";

import { RepeatPicker } from "./RepeatPicker";
import {
  TaskModalShell,
  btnPrimaryCls,
  btnSecondaryCls,
  fieldLabelCls,
  inputCls,
  selectCls,
  textareaCls,
} from "./TaskModalShell";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: ProjectConfig[];
  lockedProjectId?: string;
};

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

// El formulario solo se monta con el modal abierto: el estado nace limpio en
// cada apertura (sin efectos de reset → sin setState síncrono en efectos).
export function NewTaskModal({ open, ...rest }: Props) {
  if (!open) return null;
  return <NewTaskForm {...rest} />;
}

function NewTaskForm({
  onClose,
  onCreated,
  projects,
  lockedProjectId,
}: Omit<Props, "open">) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [projectId, setProjectId] = useState<string>(
    lockedProjectId ?? projects[0]?.id ?? "",
  );
  const [profileId, setProfileId] = useState<string>("default");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [schedule, setSchedule] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles?includeTemplates=true")
      .then((r) => r.json())
      .then((data: AgentProfile[]) => {
        if (cancelled) return;
        setProfiles(data);
        setProfileId((prev) => {
          if (data.some((p) => p.id === prev)) return prev;
          return (data.find((p) => p.id === "default") ?? data[0])?.id ?? prev;
        });
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = splitProfiles(profiles);
  const selected = profiles.find((p) => p.id === profileId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!projectId) {
      setError("Project is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          prompt: prompt.trim(),
          profileId,
          status,
          schedule,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Request failed");
      }
      notify.success("Task created");
      onCreated();
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
    <TaskModalShell title="New task" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        {!lockedProjectId ? (
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelCls}>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={selectCls}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelCls}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to get done?"
            className={inputCls}
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelCls}>Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Instructions for the agent…"
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
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
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
            </select>
          </label>
        </div>

        <RepeatPicker value={schedule} onChange={setSchedule} />

        {error ? (
          <p role="alert" className="font-mono text-[12px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondaryCls}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btnPrimaryCls}>
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </TaskModalShell>
  );
}
