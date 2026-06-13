"use client";

import { useState } from "react";

import type { AppConfigModel, LaunchFlags } from "@/lib/contracts";

type Props = {
  models: AppConfigModel[];
  defaultModel: string;
  onLaunch: (flags: LaunchFlags) => void;
  disabled?: boolean;
};

const CANONICAL_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Bash",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
] as const;

function SparkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.8 3.8l2 2M10.2 10.2l2 2M12.2 3.8l-2 2M5.8 10.2l-2 2" />
    </svg>
  );
}

function PlayIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 2.8a.8.8 0 0 1 1.2-.7l8 5.2a.8.8 0 0 1 0 1.4l-8 5.2a.8.8 0 0 1-1.2-.7V2.8z" />
    </svg>
  );
}

const chipClass = (selected: boolean) =>
  `inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
    selected
      ? "border-transparent bg-primary-soft text-primary"
      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
  }`;

export function PromptComposer({ models, defaultModel, onLaunch, disabled }: Props) {
  const [rawPrompt, setRawPrompt] = useState("");
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);
  const [useImproved, setUseImproved] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [useSubagents, setUseSubagents] = useState(false);
  const [model, setModel] = useState(defaultModel);
  const [allowedTools, setAllowedTools] = useState<string[]>([
    ...CANONICAL_TOOLS,
  ]);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  const trimmedRaw = rawPrompt.trim();
  const canImprove = trimmedRaw.length > 0 && !improving;
  const effectivePrompt =
    useImproved && improvedPrompt ? improvedPrompt : rawPrompt;
  const canLaunch = !disabled && effectivePrompt.trim().length > 0;

  async function handleImprove() {
    if (!canImprove) return;
    setImproveError(null);
    setImproving(true);
    try {
      const res = await fetch("/api/prompt/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawPrompt }),
      });
      if (!res.ok) {
        let msg = `Improve failed (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          // ignore
        }
        setImproveError(msg);
        return;
      }
      const data = (await res.json()) as { improved?: string };
      if (!data.improved) {
        setImproveError("Empty response from assistant");
        return;
      }
      setImprovedPrompt(data.improved);
      setUseImproved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setImproveError(message);
    } finally {
      setImproving(false);
    }
  }

  function toggleTool(tool: string) {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  }

  function handleLaunch() {
    if (!canLaunch) return;
    const finalPrompt =
      useImproved && improvedPrompt ? improvedPrompt : rawPrompt;
    onLaunch({
      rawPrompt,
      finalPrompt,
      planMode,
      useSubagents,
      model,
      allowedTools,
    });
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleLaunch();
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-1 shadow-bevel">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-[12px] font-medium text-muted-foreground">
          Compose a task
        </h3>
        <span className="hidden items-center gap-1 text-[11px] text-faint sm:inline-flex">
          <kbd className="keycap">⌘</kbd>
          <kbd className="keycap">↵</kbd>
          <span className="ml-1">to run</span>
        </span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        {/* Prompt input with the "AI" gradient border */}
        <div className="ai-border">
          <textarea
            rows={4}
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Describe the task for the agent…"
            disabled={disabled}
            aria-label="Task prompt"
            className="block w-full resize-y rounded-lg bg-background/60 px-3.5 py-3 text-[14px] leading-relaxed text-foreground placeholder:text-faint focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleImprove}
            disabled={!canImprove || disabled}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-[12px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-2 disabled:hover:text-muted-foreground"
          >
            <SparkIcon />
            {improving ? "Improving…" : "Improve with AI"}
          </button>
          {improveError ? (
            <span role="alert" className="text-[12px] text-destructive">
              {improveError}
            </span>
          ) : null}
        </div>

        {improvedPrompt ? (
          <div className="animate-enter flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary">
                <SparkIcon className="h-3 w-3" />
                Improved prompt
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={useImproved}
                  onChange={(e) => setUseImproved(e.target.checked)}
                  className="accent-primary"
                />
                Use improved
              </label>
            </div>
            <textarea
              rows={4}
              value={improvedPrompt}
              onChange={(e) => setImprovedPrompt(e.target.value)}
              disabled={disabled}
              aria-label="Improved prompt"
              className="w-full resize-y rounded-md border border-input bg-background/60 px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-60"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlanMode((v) => !v)}
            disabled={disabled}
            aria-pressed={planMode}
            className={chipClass(planMode)}
          >
            Plan mode
          </button>
          <button
            type="button"
            onClick={() => setUseSubagents((v) => !v)}
            disabled={disabled}
            aria-pressed={useSubagents}
            className={chipClass(useSubagents)}
          >
            Subagents
          </button>

          <label className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={disabled}
              className="h-7 rounded-md border border-input bg-surface-2 px-2 text-[12px] text-foreground focus:outline-none disabled:opacity-60"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-faint">
            Allowed tools
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {CANONICAL_TOOLS.map((tool) => {
              const selected = allowedTools.includes(tool);
              return (
                <li key={tool}>
                  <button
                    type="button"
                    onClick={() => toggleTool(tool)}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? "border-transparent bg-primary-soft text-primary"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tool}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-5 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint disabled:shadow-none"
          >
            <PlayIcon />
            Run agent
          </button>
        </div>
      </div>
    </section>
  );
}
