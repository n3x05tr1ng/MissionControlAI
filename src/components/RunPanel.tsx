"use client";

import Link from "next/link";
import { useState } from "react";

import { ActivityFeed } from "@/components/ActivityFeed";
import { PromptComposer } from "@/components/PromptComposer";
import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import type { AppConfigModel, LaunchFlags } from "@/lib/contracts";

type Props = {
  projectId: string;
  models: AppConfigModel[];
  defaultModel: string;
};

type ErrorState =
  | { kind: "none" }
  | { kind: "missingKey" }
  | { kind: "generic"; message: string };

/** The run API answers 400 both for a missing Anthropic key and for malformed
 *  bodies — only the key case deserves the "configure your key" banner. */
function isMissingKeyMessage(message: string): boolean {
  return message.includes("ANTHROPIC_API_KEY");
}

export function RunPanel({ projectId, models, defaultModel }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });

  async function handleLaunch(flags: LaunchFlags) {
    if (isRunning || isPosting) return;
    setError({ kind: "none" });
    setIsPosting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      });

      if (res.ok) return;

      let msg = `Run failed (${res.status})`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) msg = data.error;
      } catch {
        // ignore
      }

      if (res.status === 400 && isMissingKeyMessage(msg)) {
        setError({ kind: "missingKey" });
        return;
      }

      setError({ kind: "generic", message: msg });
      notify.error(msg);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError({ kind: "generic", message });
      notify.error(message);
    } finally {
      setIsPosting(false);
    }
  }

  const busy = isRunning || isPosting;

  async function handleStop() {
    const ok = await confirm({
      title: "Stop run?",
      message: "The agent will be aborted. The session row is marked error.",
      danger: true,
      confirmLabel: "Stop",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        notify.error(`Stop failed (${res.status})`);
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

  return (
    <div className="flex flex-col gap-4">
      <PromptComposer
        models={models}
        defaultModel={defaultModel}
        onLaunch={handleLaunch}
        disabled={busy}
      />

      {isRunning ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive-soft px-3 text-[13px] font-medium text-destructive hover:bg-destructive/25"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="1.5" />
            </svg>
            Stop run
          </button>
        </div>
      ) : null}

      {error.kind === "missingKey" ? (
        <div
          role="alert"
          className="animate-enter flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-[13px] text-warning"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <circle cx="5.5" cy="10.5" r="3" />
            <path d="M8 8.5 13.5 3M11 5.5l2 2" />
          </svg>
          <span>
            An Anthropic API key is required to launch runs.{" "}
            <Link
              href="/settings"
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Add it in Settings
            </Link>
          </span>
        </div>
      ) : null}

      {error.kind === "generic" ? (
        <div
          role="alert"
          className="animate-enter rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive"
        >
          {error.message}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface-1 shadow-bevel">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-[12px] font-medium text-muted-foreground">
            Engine activity
          </h3>
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary">
              <span className="ai-pulse h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              running
            </span>
          ) : null}
        </header>
        <div className="p-4">
          <ActivityFeed projectId={projectId} onRunStateChange={setIsRunning} />
        </div>
      </section>
    </div>
  );
}
