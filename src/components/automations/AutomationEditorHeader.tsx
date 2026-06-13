"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PROFILE_ICON_NAMES,
  ProfileIcon,
} from "@/components/icons/ProfileIcons";
import { RepeatPicker } from "@/components/board/RepeatPicker";
import { confirm } from "@/components/ui/ConfirmDialog";
import type { Automation } from "@/lib/contracts";
import { notify } from "@/lib/ui/notify";

type Props = {
  automation: Automation;
};

const COLORS = [
  "#f5a623",
  "#5cc8ff",
  "#a18cff",
  "#ff7a7a",
  "#7adda0",
  "#ffd166",
  "#9fa8b3",
];

export function AutomationEditorHeader({ automation }: Props) {
  const router = useRouter();
  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description ?? "");
  const [color, setColor] = useState(automation.color);
  const [icon, setIcon] = useState(automation.icon);
  const [enabled, setEnabled] = useState(automation.enabled);
  const [schedule, setSchedule] = useState<string | null>(automation.schedule);
  const [editingName, setEditingName] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  // Debounce description saves
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      notify.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function saveName() {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === automation.name) return;
    void patch({ name: trimmed });
  }

  useEffect(() => {
    if (description === (automation.description ?? "")) return;
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => {
      void patch({ description: description.trim() || null });
    }, 600);
    return () => {
      if (descTimer.current) clearTimeout(descTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  function pickColor(c: string) {
    setColor(c);
    void patch({ color: c });
  }

  function pickIcon(n: string) {
    setIcon(n);
    setShowIcons(false);
    void patch({ icon: n });
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    void patch({ enabled: next });
  }

  function changeSchedule(cron: string | null) {
    setSchedule(cron);
    void patch({ schedule: cron });
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch(`/api/automations/${automation.id}/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runId: string };
      notify.success("Run started");
      router.push(`/automation-runs/${data.runId}`);
    } catch (err) {
      notify.error(`Run failed: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function deleteAutomation() {
    const ok = await confirm({
      title: "Delete automation?",
      message: `"${automation.name}" and its run history will be removed.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify.success("Automation deleted");
      router.push("/automations");
      router.refresh();
    } catch (err) {
      notify.error(`Delete failed: ${(err as Error).message}`);
    }
  }

  return (
    <header className="animate-enter flex flex-col gap-4">
      {/* Patrón PageHeader (overline + H1 real), con rename inline */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="hive-overline">[ AUTOMATION ]</p>
          {editingName ? (
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setName(automation.name);
                  setEditingName(false);
                }
              }}
              className="hive-h1 w-full rounded-md border border-primary/50 bg-background px-2 py-0.5"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="hive-h1 w-full truncate text-left hover:text-primary"
              title="Click to rename"
            >
              {name}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={running || busy}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M4 2.8v8.4c0 .5.55.8.97.53l6.06-4.2a.64.64 0 0 0 0-1.06L4.97 2.27A.64.64 0 0 0 4 2.8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {running ? "Starting…" : "Run now"}
        </button>
      </div>

      {/* Card de configuración con el acento de color integrado */}
      <div className="hive-card relative overflow-hidden">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: color }}
        />
        <div className="flex flex-col gap-4 p-4 pl-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setShowIcons((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border hover:border-border-strong"
              style={{
                color,
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
              }}
              aria-label="Change icon"
              aria-expanded={showIcons}
            >
              <ProfileIcon name={icon} size={22} />
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what this automation does…"
                className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] leading-relaxed text-muted-foreground placeholder:text-faint"
              />
            </label>
          </div>

          {showIcons ? (
            <div className="animate-enter flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface-2/50 p-2">
              {PROFILE_ICON_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickIcon(n)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                    icon === n
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                  aria-label={`Icon ${n}`}
                  aria-pressed={icon === n}
                >
                  <ProfileIcon name={n} size={16} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              Color
            </span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pickColor(c)}
                className={`h-5 w-5 rounded-full border-2 ${
                  color === c
                    ? "scale-110 border-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <RepeatPicker value={schedule} onChange={changeSchedule} />
            <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
              <span className="text-[12px] font-medium text-muted-foreground">
                Status
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={toggleEnabled}
                  className="accent-primary"
                />
                <span>{enabled ? "Enabled" : "Disabled"}</span>
              </label>
              <button
                type="button"
                onClick={() => void deleteAutomation()}
                className="self-start text-[12px] font-medium text-destructive hover:opacity-80"
              >
                Delete automation
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
