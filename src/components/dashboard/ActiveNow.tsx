"use client";

import { useEffect, useRef, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";

interface ActiveRun {
  sessionId: string;
  projectId: string;
  projectName: string;
  startedAt: number;
  ageMs: number;
}

const POLL_MS = 2500;

function formatAge(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ActiveNow() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  // Re-render every second so the live mm:ss counter ticks without re-fetch.
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch("/api/runs/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ActiveRun[];
        if (mountedRef.current) setRuns(data);
      } catch {
        // network blips are noisy; the next poll will catch up.
      }
    }
    void fetchRuns();
    const id = setInterval(fetchRuns, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function stop(run: ActiveRun): Promise<void> {
    const ok = await confirm({
      title: "Stop this run?",
      message: `Stop the agent running in "${run.projectName}". Any in-flight work will be cancelled.`,
      confirmLabel: "Stop run",
      danger: true,
    });
    if (!ok) return;

    setStoppingId(run.sessionId);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(run.projectId)}/stop`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: run.sessionId }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      notify.success("Run stopped");
      setRuns((prev) => prev.filter((r) => r.sessionId !== run.sessionId));
    } catch (err) {
      notify.error((err as Error).message);
    } finally {
      if (mountedRef.current) setStoppingId(null);
    }
  }

  if (runs.length === 0) {
    return (
      <section className="border border-hive-border bg-hive-panel px-4 py-2">
        <p className="font-mono text-[11px] text-hive-muted">
          [ ACTIVE NOW ] No active runs right now.
        </p>
      </section>
    );
  }

  const now = Date.now();
  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="border-b border-hive-border px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ ACTIVE NOW · {runs.length} ]
        </h3>
      </header>
      <div className="flex gap-3 overflow-x-auto p-3">
        {runs.map((r) => {
          const age = now - r.startedAt;
          return (
            <div
              key={r.sessionId}
              className="flex min-w-[200px] shrink-0 flex-col gap-2 border border-hive-border bg-hive-bg p-3"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-hive-amber" />
                <span className="truncate text-sm text-hive-text">
                  {r.projectName}
                </span>
              </div>
              <div className="font-mono text-[11px] text-hive-cyan">
                {formatAge(age)}
              </div>
              <button
                type="button"
                onClick={() => void stop(r)}
                disabled={stoppingId === r.sessionId}
                className="border border-hive-red/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-hive-red hover:bg-hive-red/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stoppingId === r.sessionId ? "stopping…" : "stop"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
