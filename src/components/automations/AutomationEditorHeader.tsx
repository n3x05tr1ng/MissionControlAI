"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PROFILE_ICON_NAMES, ProfileIcon } from "@/components/icons/ProfileIcons";
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
    <div className="border border-hive-border bg-hive-panel">
      <div
        className="h-2"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowIcons((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-hive-border hover:border-hive-amber"
              style={{ color }}
              aria-label="Change icon"
            >
              <ProfileIcon name={icon} size={22} />
            </button>
            <div className="min-w-0 flex-1">
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
                  className="w-full bg-hive-bg border border-hive-amber px-2 py-1 font-sans text-xl text-hive-text focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-left font-sans text-xl text-hive-text hover:text-hive-amber truncate w-full"
                  title="Click to rename"
                >
                  {name}
                </button>
              )}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what this automation does…"
                className="mt-2 w-full bg-hive-bg border border-hive-border px-2 py-1 text-xs text-hive-muted resize-none focus:border-hive-amber focus:outline-none"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={running || busy}
              className="border border-hive-amber bg-hive-amber/20 px-4 py-2 font-mono text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/30 disabled:opacity-50"
            >
              {running ? "starting…" : "▶ Run now"}
            </button>
          </div>
        </div>

        {showIcons ? (
          <div className="flex flex-wrap gap-1.5 border border-hive-border p-2">
            {PROFILE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pickIcon(n)}
                className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                  icon === n
                    ? "border-hive-amber text-hive-amber"
                    : "border-hive-border text-hive-muted hover:text-hive-text"
                }`}
                aria-label={`icon ${n}`}
              >
                <ProfileIcon name={n} size={16} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Color
          </span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColor(c)}
              className={`h-5 w-5 border-2 transition-transform ${color === c ? "scale-110 border-hive-text" : "border-hive-border"}`}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <RepeatPicker value={schedule} onChange={changeSchedule} />
          <div className="flex flex-col gap-2 border border-hive-border p-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Status
            </span>
            <label className="flex items-center gap-2 text-sm text-hive-text">
              <input
                type="checkbox"
                checked={enabled}
                onChange={toggleEnabled}
              />
              <span>{enabled ? "Enabled" : "Disabled"}</span>
            </label>
            <button
              type="button"
              onClick={() => void deleteAutomation()}
              className="self-start font-mono text-[10px] uppercase tracking-widest text-red-400 hover:text-red-300"
            >
              Delete automation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
