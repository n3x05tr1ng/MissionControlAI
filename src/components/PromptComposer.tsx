"use client";

import { useState } from "react";

import type { AppConfigModel, LaunchFlags } from "@/lib/contracts";

type Props = {
  projectId: string;
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

export function PromptComposer({
  projectId: _projectId,
  models,
  defaultModel,
  onLaunch,
  disabled,
}: Props) {
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

  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ COMPOSE ]
        </h3>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <textarea
          rows={4}
          value={rawPrompt}
          onChange={(e) => setRawPrompt(e.target.value)}
          placeholder="> describe the task for Claude..."
          disabled={disabled}
          className="w-full resize-y border border-hive-border bg-hive-bg/60 px-3 py-2 font-mono text-xs text-hive-text placeholder:text-hive-muted focus:border-hive-amber focus:outline-none disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleImprove}
            disabled={!canImprove || disabled}
            className="border border-hive-amber bg-hive-amber/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:cursor-not-allowed disabled:border-hive-border disabled:bg-hive-bg/40 disabled:text-hive-muted"
          >
            {improving ? "improving..." : "[ improve with ai ]"}
          </button>
          {improveError ? (
            <span className="font-mono text-[10px] text-hive-red">
              {improveError}
            </span>
          ) : null}
        </div>

        {improvedPrompt ? (
          <div className="flex flex-col gap-2 border border-hive-border bg-hive-bg/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                improved
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
                <input
                  type="checkbox"
                  checked={useImproved}
                  onChange={(e) => setUseImproved(e.target.checked)}
                  className="accent-hive-amber"
                />
                use improved
              </label>
            </div>
            <textarea
              rows={4}
              value={improvedPrompt}
              onChange={(e) => setImprovedPrompt(e.target.value)}
              disabled={disabled}
              className="w-full resize-y border border-hive-border bg-hive-bg/60 px-3 py-2 font-mono text-xs text-hive-text focus:border-hive-amber focus:outline-none disabled:opacity-60"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlanMode((v) => !v)}
            disabled={disabled}
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest disabled:cursor-not-allowed ${
              planMode
                ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
                : "border-hive-border bg-hive-bg/40 text-hive-muted hover:text-hive-text"
            }`}
          >
            plan mode
          </button>
          <button
            type="button"
            onClick={() => setUseSubagents((v) => !v)}
            disabled={disabled}
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest disabled:cursor-not-allowed ${
              useSubagents
                ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
                : "border-hive-border bg-hive-bg/40 text-hive-muted hover:text-hive-text"
            }`}
          >
            subagents
          </button>

          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={disabled}
              className="border border-hive-border bg-hive-bg/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-hive-text focus:border-hive-amber focus:outline-none"
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            allowed tools
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
                    className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest disabled:cursor-not-allowed ${
                      selected
                        ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
                        : "border-hive-border bg-hive-bg/40 text-hive-muted hover:text-hive-text"
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
            className="border border-hive-amber bg-hive-amber/10 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 disabled:cursor-not-allowed disabled:border-hive-border disabled:bg-hive-bg/40 disabled:text-hive-muted"
          >
            [ run ]
          </button>
        </div>
      </div>
    </section>
  );
}
