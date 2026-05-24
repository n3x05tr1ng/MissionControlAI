"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActivityFeed } from "@/components/ActivityFeed";
import { PromptComposer } from "@/components/PromptComposer";
import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import type { AppConfigModel, LaunchFlags } from "@/lib/contracts";

type EngineProviderId = "claude-cli" | "claude-code";

type Props = {
  projectId: string;
  models: AppConfigModel[];
  defaultModel: string;
};

type ErrorState =
  | { kind: "none" }
  | { kind: "missingKey" }
  | { kind: "generic"; message: string };

export function RunPanel({ projectId, models, defaultModel }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });
  const [engineProvider, setEngineProvider] = useState<EngineProviderId>("claude-cli");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { engine_provider?: EngineProviderId };
        if (
          !cancelled &&
          (data.engine_provider === "claude-cli" ||
            data.engine_provider === "claude-code")
        ) {
          setEngineProvider(data.engine_provider);
        }
      } catch {
        // ignore — keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      if (res.status === 400) {
        setError({ kind: "missingKey" });
        return;
      }

      let msg = `Run failed (${res.status})`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) msg = data.error;
      } catch {
        // ignore
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
      message:
        "The agent will be aborted. The session row is marked error.",
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
        projectId={projectId}
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
            className="border border-red-500/60 bg-red-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-red-300 hover:bg-red-500/20"
          >
            ■ STOP run
          </button>
        </div>
      ) : null}

      {error.kind === "missingKey" && engineProvider === "claude-code" ? (
        <div className="border border-hive-red/60 bg-hive-red/10 px-3 py-2 font-mono text-xs text-hive-red">
          <Link href="/settings" className="underline hover:text-hive-amber">
            Configure your Anthropic API key first
          </Link>
        </div>
      ) : null}

      {error.kind === "generic" ? (
        <div className="border border-hive-red/60 bg-hive-red/10 px-3 py-2 font-mono text-xs text-hive-red">
          {error.message}
        </div>
      ) : null}

      <section className="border border-hive-border bg-hive-panel">
        <header className="border-b border-hive-border px-4 py-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ ENGINE — claude-code ]
          </h3>
        </header>
        <div className="p-4">
          <ActivityFeed projectId={projectId} onRunStateChange={setIsRunning} />
        </div>
      </section>
    </div>
  );
}
