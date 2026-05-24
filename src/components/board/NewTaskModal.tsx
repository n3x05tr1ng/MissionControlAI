"use client";

import { useEffect, useState } from "react";

import { notify } from "@/lib/ui/notify";
import type { AgentProfile, ProjectConfig, TaskStatus } from "@/lib/contracts";

import { RepeatPicker } from "./RepeatPicker";

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

export function NewTaskModal({
  open,
  onClose,
  onCreated,
  projects,
  lockedProjectId,
}: Props) {
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
    if (!open) return;
    fetch("/api/profiles?includeTemplates=true")
      .then((r) => r.json())
      .then((data: AgentProfile[]) => {
        setProfiles(data);
        if (data.length > 0 && !data.find((p) => p.id === profileId)) {
          const def = data.find((p) => p.id === "default") ?? data[0];
          setProfileId(def.id);
        }
      })
      .catch(() => setProfiles([]));
  }, [open, profileId]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setPrompt("");
      setStatus("backlog");
      setError(null);
      setProjectId(lockedProjectId ?? projects[0]?.id ?? "");
      setProfileId("default");
      setSchedule(null);
    }
  }, [open, lockedProjectId, projects]);

  if (!open) return null;

  const groups = splitProfiles(profiles);

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

  const selected = profiles.find((p) => p.id === profileId);

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
            [ NEW TASK ]
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-hive-muted hover:text-hive-amber text-sm"
          >
            ✕
          </button>
        </header>
        <form onSubmit={submit} className="p-4 flex flex-col gap-3">
          {!lockedProjectId ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                Project
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text"
              autoFocus
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
                {groups.map((g) => (
                  <optgroup key={g.label} label={`— ${g.label} —`}>
                    {g.options.map((p) => (
                      <option key={p.id} value={p.id}>
                        ● {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
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
              </select>
            </label>
          </div>

          <RepeatPicker value={schedule} onChange={setSchedule} />

          {error ? (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
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
              {busy ? "creating…" : "create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
