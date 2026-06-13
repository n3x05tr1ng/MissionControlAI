"use client";

import { useEffect, useRef, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { msSince } from "@/lib/time";
import { notify } from "@/lib/ui/notify";

interface ActiveRun {
  sessionId: string;
  projectId: string;
  projectName: string;
  startedAt: number;
  ageMs: number;
}

// Live updates ride the existing /api/projects/stream SSE — every project
// status change (run started/finished) publishes a project_index event, so a
// debounced refetch keeps this list fresh without fast polling. The slow
// interval below is only a safety net for missed events / dropped streams.
const SSE_REFETCH_DEBOUNCE_MS = 400;
const FALLBACK_POLL_MS = 30_000;
const NO_SSE_POLL_MS = 5_000;

function formatAge(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ActiveNow() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  // Re-render every second so the mm:ss counter ticks (only while runs exist).
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
        // network blips are noisy; the next event/poll will catch up.
      }
    }
    void fetchRuns();

    const hasSse =
      typeof window !== "undefined" &&
      typeof window.EventSource !== "undefined";

    // Safety-net poll: slow when SSE drives updates, faster without it.
    const pollId = setInterval(
      () => void fetchRuns(),
      hasSse ? FALLBACK_POLL_MS : NO_SSE_POLL_MS,
    );

    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    if (hasSse) {
      es = new EventSource("/api/projects/stream");
      es.onopen = () => {
        if (mountedRef.current) setLive(true);
      };
      es.onerror = () => {
        // The browser auto-reconnects; surface the degraded state meanwhile.
        if (mountedRef.current) setLive(false);
      };
      es.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data) as { type?: string };
          if (!frame || typeof frame.type !== "string") return;
          // Snapshot fires on connect — the mount fetch already covered it.
          if (frame.type === "snapshot") return;
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void fetchRuns(), SSE_REFETCH_DEBOUNCE_MS);
        } catch {
          // ignore malformed frames
        }
      };
    }

    return () => {
      clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
      if (es) es.close();
    };
  }, []);

  const hasRuns = runs.length > 0;
  useEffect(() => {
    if (!hasRuns) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hasRuns]);

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

  const liveBadge = (
    <span
      className="flex items-center gap-1.5 font-mono text-[11px] text-faint"
      title={live ? "Live via server events" : "Updating via slow polling"}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live ? "animate-pulse bg-success" : "bg-faint"
        }`}
        aria-hidden="true"
      />
      {live ? "live" : "polling"}
    </span>
  );

  if (!hasRuns) {
    return (
      <section className="hive-card animate-enter flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-faint"
            aria-hidden="true"
          />
          No active runs right now.
        </p>
        {liveBadge}
      </section>
    );
  }

  return (
    <section className="hive-card animate-enter overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          Active now
          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[11px] text-primary">
            {runs.length}
          </span>
        </h3>
        {liveBadge}
      </header>
      <div className="stagger-children flex gap-3 overflow-x-auto p-3">
        {runs.map((r) => {
          const age = msSince(r.startedAt);
          return (
            <div
              key={r.sessionId}
              className="flex min-w-[220px] shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span className="truncate text-[13px] font-medium text-foreground">
                  {r.projectName}
                </span>
              </div>
              <div className="font-mono text-[12px] tabular-nums text-primary">
                {formatAge(age)}
              </div>
              <button
                type="button"
                onClick={() => void stop(r)}
                disabled={stoppingId === r.sessionId}
                className="h-7 self-start rounded-md border border-destructive/40 bg-destructive-soft px-2.5 text-[12px] font-medium text-destructive hover:bg-destructive/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stoppingId === r.sessionId ? "Stopping…" : "Stop"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
