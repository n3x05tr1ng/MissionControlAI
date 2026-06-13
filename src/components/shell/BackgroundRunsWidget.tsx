"use client";

import { useEffect, useState } from "react";

import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";

interface ActiveRun {
  sessionId: string;
  projectId: string;
  projectName: string;
  startedAt: number;
  ageMs: number;
}

const POLL_MS = 3000;

function fmtAge(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function BackgroundRunsWidget() {
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/runs/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ActiveRun[];
        if (cancelled) return;
        setRuns(data);
      } catch {
        // network blip — keep last state
      }
    }
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Re-render second-by-second when drawer is open for live age.
  useEffect(() => {
    if (!openDrawer) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const timeout = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, [openDrawer]);

  async function stopOne(r: ActiveRun) {
    const ok = await confirm({
      title: "Stop run?",
      message: `Stop run on ${r.projectName} (${r.sessionId.slice(0, 8)})?`,
      danger: true,
      confirmLabel: "Stop",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${r.projectId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: r.sessionId }),
      });
      if (!res.ok) {
        notify.error(`Stop failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { stopped: number };
      if (data.stopped > 0) notify.success("Stopped");
      else notify.info("Run already ended");
      setRuns((prev) => prev.filter((x) => x.sessionId !== r.sessionId));
    } catch (err) {
      notify.error((err as Error).message);
    }
  }

  const hasRuns = runs.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenDrawer(true)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-2"
        title={hasRuns ? "Show active runs" : "No active runs"}
      >
        {hasRuns ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
        ) : (
          <span className="inline-flex h-2 w-2 rounded-full bg-faint/40" />
        )}
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
          {hasRuns
            ? `${runs.length} run${runs.length === 1 ? "" : "s"} active`
            : "no active runs"}
        </span>
      </button>

      {openDrawer ? (
        <div
          className="hive-modal-overlay fixed inset-0 z-[110] flex justify-end bg-black/50 backdrop-blur-[2px]"
          onClick={() => setOpenDrawer(false)}
        >
          <div
            className="glass flex h-full w-[360px] flex-col rounded-l-xl shadow-overlay"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-runs-title"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2
                id="active-runs-title"
                className="text-sm font-medium text-foreground"
              >
                Active runs
              </h2>
              <button
                type="button"
                onClick={() => setOpenDrawer(false)}
                aria-label="Close"
                className="keycap hover:text-foreground"
              >
                esc
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              {runs.length === 0 ? (
                <p className="px-4 py-6 font-mono text-xs text-faint">
                  no active runs.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {runs.map((r) => (
                    <li
                      key={r.sessionId}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">
                          {r.projectName}
                        </span>
                        <button
                          type="button"
                          onClick={() => stopOne(r)}
                          className="rounded-md border border-destructive/40 bg-destructive-soft px-2 py-0.5 font-mono text-[11px] text-destructive hover:bg-destructive/25"
                        >
                          stop
                        </button>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
                        <span>{r.sessionId.slice(0, 8)}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {fmtAge(Math.max(0, now - r.startedAt))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
