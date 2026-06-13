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

const chipBase = "rounded-full border px-2.5 py-1 font-mono text-[11px]";
const chipActive = "border-primary/50 bg-primary-soft text-primary";
const chipIdle =
  "border-border text-muted-foreground hover:border-border-strong hover:text-foreground";

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
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-surface-1 p-3">
      <span className="text-[12px] font-medium text-muted-foreground">
        Repeat
      </span>

      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
        <input
          type="radio"
          name="repeat-mode"
          className="size-3.5 accent-primary"
          checked={value === null}
          onChange={selectNever}
        />
        <span>Never (one-shot)</span>
      </label>

      <div className="flex flex-wrap gap-1.5">
        {CRON_PRESETS.map((p) => {
          const active = value === p.cron;
          return (
            <button
              key={p.cron}
              type="button"
              aria-pressed={active}
              onClick={() => selectPreset(p.cron)}
              className={`${chipBase} ${active ? chipActive : chipIdle}`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showCustom}
          onClick={openCustom}
          className={`${chipBase} ${showCustom ? chipActive : chipIdle}`}
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
          aria-label="Custom cron expression"
          className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] text-foreground placeholder:text-faint"
        />
      ) : null}

      {value !== null && !valid ? (
        <p role="alert" className="font-mono text-[12px] text-destructive">
          Invalid cron expression
        </p>
      ) : null}

      {value !== null && valid && preview.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-faint">
            Next 3 runs
          </span>
          {preview.map((d, i) => (
            <span key={i} className="font-mono text-[12px] text-muted-foreground">
              {formatLocal(d)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
