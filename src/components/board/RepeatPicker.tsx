"use client";

import { useMemo, useState } from "react";

import {
  CRON_PRESETS,
  isValidCron,
  nextRuns,
} from "@/lib/tasks/cronPresets";

type Props = {
  value: string | null;
  onChange: (cron: string | null) => void;
};

function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function RepeatPicker({ value, onChange }: Props) {
  const isPreset = useMemo(
    () => value !== null && CRON_PRESETS.some((p) => p.cron === value),
    [value],
  );
  const [showCustom, setShowCustom] = useState<boolean>(
    value !== null && !isPreset,
  );
  const [customDraft, setCustomDraft] = useState<string>(
    value !== null && !isPreset ? value : "",
  );

  const valid = value === null ? true : isValidCron(value);
  const preview = useMemo(() => {
    if (!value || !valid) return [];
    return nextRuns(value, 3);
  }, [value, valid]);

  function selectNever() {
    setShowCustom(false);
    setCustomDraft("");
    onChange(null);
  }

  function selectPreset(cron: string) {
    setShowCustom(false);
    setCustomDraft("");
    onChange(cron);
  }

  function openCustom() {
    setShowCustom(true);
    if (value && !CRON_PRESETS.some((p) => p.cron === value)) {
      setCustomDraft(value);
    }
  }

  function onCustomChange(v: string) {
    setCustomDraft(v);
    const trimmed = v.trim();
    if (trimmed.length === 0) {
      onChange(null);
      return;
    }
    onChange(trimmed);
  }

  return (
    <div className="flex flex-col gap-2 border border-hive-border p-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        Repeat
      </span>

      <label className="flex items-center gap-2 text-xs text-hive-text cursor-pointer">
        <input
          type="radio"
          name="repeat-mode"
          checked={value === null}
          onChange={selectNever}
        />
        <span>Never (one-shot)</span>
      </label>

      <div className="flex flex-wrap gap-1">
        {CRON_PRESETS.map((p) => {
          const active = value === p.cron;
          return (
            <button
              key={p.cron}
              type="button"
              onClick={() => selectPreset(p.cron)}
              className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-1 transition-colors ${
                active
                  ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
                  : "border-hive-border text-hive-muted hover:text-hive-text"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={openCustom}
          className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-1 transition-colors ${
            showCustom
              ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
              : "border-hive-border text-hive-muted hover:text-hive-text"
          }`}
        >
          Custom…
        </button>
      </div>

      {showCustom ? (
        <input
          type="text"
          value={customDraft}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="m h dom mon dow"
          className="bg-hive-bg border border-hive-border px-2 py-1 text-sm text-hive-text font-mono"
        />
      ) : null}

      {value !== null && !valid ? (
        <p className="text-xs text-red-400 font-mono">
          Invalid cron expression
        </p>
      ) : null}

      {value !== null && valid && preview.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Next 3 runs
          </span>
          {preview.map((d, i) => (
            <span
              key={i}
              className="font-mono text-[11px] text-hive-text/80"
            >
              {formatLocal(d)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
