"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { notify } from "@/lib/ui/notify";
import { openModal } from "@/lib/ui/modalBus";
import type { AgentProfile, ProjectConfig } from "@/lib/contracts";

interface ProjectSnapshot {
  config: ProjectConfig;
}

const CACHE_MS = 5000;

interface CacheBox<T> {
  data: T | null;
  at: number;
}

const projectsCache: CacheBox<ProjectConfig[]> = { data: null, at: 0 };
const profilesCache: CacheBox<AgentProfile[]> = { data: null, at: 0 };

async function loadProjects(): Promise<ProjectConfig[]> {
  if (
    projectsCache.data &&
    Date.now() - projectsCache.at < CACHE_MS
  ) {
    return projectsCache.data;
  }
  try {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) return projectsCache.data ?? [];
    const data = (await res.json()) as ProjectSnapshot[];
    const list = data.map((s) => s.config);
    projectsCache.data = list;
    projectsCache.at = Date.now();
    return list;
  } catch {
    return projectsCache.data ?? [];
  }
}

async function loadProfiles(): Promise<AgentProfile[]> {
  if (
    profilesCache.data &&
    Date.now() - profilesCache.at < CACHE_MS
  ) {
    return profilesCache.data;
  }
  try {
    const res = await fetch("/api/profiles?includeTemplates=false", {
      cache: "no-store",
    });
    if (!res.ok) return profilesCache.data ?? [];
    const data = (await res.json()) as AgentProfile[];
    profilesCache.data = data;
    profilesCache.at = Date.now();
    return data;
  } catch {
    return profilesCache.data ?? [];
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);

  // Global toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Refresh data when opened
  useEffect(() => {
    if (!open) return;
    void loadProjects().then(setProjects);
    void loadProfiles().then(setProfiles);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const go = useCallback(
    (path: string) => {
      close();
      router.push(path);
    },
    [router, close],
  );

  async function stopAll() {
    close();
    try {
      const res = await fetch("/api/runs/stopAll", { method: "POST" });
      if (!res.ok) {
        notify.error(`Stop all failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { stopped: number };
      if (data.stopped > 0) {
        notify.success(`Stopped ${data.stopped} run${data.stopped === 1 ? "" : "s"}`);
      } else {
        notify.info("No active runs");
      }
    } catch (err) {
      notify.error((err as Error).message);
    }
  }

  function trigger(
    name:
      | "newProject"
      | "newTask"
      | "newProfile"
      | "newReminder"
      | "newAutomation",
  ) {
    close();
    openModal(name);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-4 pt-[12vh] hive-modal-overlay"
      onClick={close}
    >
      <div
        className="w-full max-w-[640px] border border-hive-border bg-hive-panel shadow-2xl hive-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Command palette"
          loop
          className="flex flex-col"
        >
          <div className="border-b border-hive-border px-3 py-2 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
              [ CMD ]
            </span>
            <Command.Input
              placeholder="Type a command or search…"
              autoFocus
              className="flex-1 bg-transparent font-mono text-sm text-hive-text outline-none placeholder:text-hive-muted"
            />
            <kbd className="font-mono text-[10px] uppercase tracking-widest text-hive-muted border border-hive-border px-1.5 py-0.5">
              esc
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-4 text-center font-mono text-xs text-hive-muted">
              no results.
            </Command.Empty>

            <Command.Group
              heading="Navigation"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-hive-muted"
            >
              <PaletteItem onSelect={() => go("/")}>Go to Dashboard</PaletteItem>
              <PaletteItem onSelect={() => go("/automations")}>Go to Automations</PaletteItem>
              <PaletteItem onSelect={() => go("/profiles")}>Go to Profiles</PaletteItem>
              <PaletteItem onSelect={() => go("/assistant")}>Go to Assistant</PaletteItem>
              <PaletteItem onSelect={() => go("/reminders")}>Go to Reminders</PaletteItem>
              <PaletteItem onSelect={() => go("/settings")}>Go to Settings</PaletteItem>
            </Command.Group>

            <Command.Group
              heading="Create"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-hive-muted"
            >
              <PaletteItem onSelect={() => trigger("newProject")}>+ New project</PaletteItem>
              <PaletteItem onSelect={() => trigger("newTask")}>+ New task</PaletteItem>
              <PaletteItem onSelect={() => trigger("newProfile")}>+ New profile</PaletteItem>
              <PaletteItem onSelect={() => trigger("newReminder")}>+ New reminder</PaletteItem>
              <PaletteItem onSelect={() => trigger("newAutomation")}>+ New automation</PaletteItem>
            </Command.Group>

            {projects.length > 0 ? (
              <Command.Group
                heading="Projects"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-hive-muted"
              >
                {projects.map((p) => (
                  <PaletteItem
                    key={`proj-${p.id}`}
                    value={`open project ${p.name} ${p.id}`}
                    onSelect={() => go(`/projects/${p.id}`)}
                  >
                    Open <span className="text-hive-amber">{p.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            ) : null}

            {profiles.length > 0 ? (
              <Command.Group
                heading="Profiles"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-hive-muted"
              >
                {profiles.map((p) => (
                  <PaletteItem
                    key={`prof-${p.id}`}
                    value={`edit profile ${p.name} ${p.id}`}
                    onSelect={() => go(`/profiles/${p.id}`)}
                  >
                    Edit profile: <span className="text-hive-amber">{p.name}</span>
                  </PaletteItem>
                ))}
              </Command.Group>
            ) : null}

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-hive-muted"
            >
              {projects.map((p) => (
                <PaletteItem
                  key={`term-${p.id}`}
                  value={`open terminal ${p.name}`}
                  onSelect={() => go(`/projects/${p.id}?terminal=claude`)}
                >
                  Open terminal in <span className="text-hive-amber">{p.name}</span>
                </PaletteItem>
              ))}
              <PaletteItem onSelect={stopAll}>
                <span className="text-red-300">Stop all running sessions</span>
              </PaletteItem>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  onSelect: () => void;
  children: React.ReactNode;
  value?: string;
}

function PaletteItem({ onSelect, children, value }: PaletteItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      value={value}
      className="font-mono text-sm text-hive-text/90 px-3 py-2 cursor-pointer rounded-none data-[selected=true]:bg-hive-amber/15 data-[selected=true]:text-hive-amber data-[selected=true]:border-l-2 data-[selected=true]:border-hive-amber"
    >
      {children}
    </Command.Item>
  );
}
