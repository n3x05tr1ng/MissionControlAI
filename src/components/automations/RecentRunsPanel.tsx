"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AutomationRun, AutomationRunStatus } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  automationId: string;
};

function statusClass(status: AutomationRunStatus): string {
  switch (status) {
    case "running":
      return "border-hive-amber/60 text-hive-amber";
    case "awaiting_human":
      return "border-yellow-300/60 text-yellow-300";
    case "done":
      return "border-emerald-400/60 text-emerald-400";
    case "error":
      return "border-red-400/60 text-red-400";
    default:
      return "border-hive-border text-hive-muted";
  }
}

function duration(startedAt: string, endedAt: string | null): string {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const sec = Math.max(0, Math.round((end - start) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export function RecentRunsPanel({ automationId }: Props) {
  const [runs, setRuns] = useState<AutomationRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/automations/${automationId}/runs?limit=10`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as AutomationRun[];
      })
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message);
          setRuns([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [automationId]);

  return (
    <section className="border border-hive-border bg-hive-panel">
      <header className="flex items-center justify-between gap-2 border-b border-hive-border px-3 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ RECENT RUNS ]
        </h2>
        {error ? (
          <span
            className="font-mono text-[10px] text-hive-muted"
            title={error}
          >
            API not ready
          </span>
        ) : null}
      </header>

      {runs === null ? (
        <p className="p-3 font-mono text-[11px] uppercase tracking-widest text-hive-muted">
          loading…
        </p>
      ) : runs.length === 0 ? (
        <p className="p-3 text-sm text-hive-muted">No runs yet.</p>
      ) : (
        <ul className="divide-y divide-hive-border">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span
                className={`font-mono text-[10px] uppercase tracking-widest border px-1.5 py-0.5 ${statusClass(r.status)}`}
              >
                {r.status}
              </span>
              <span className="text-hive-muted font-mono text-[11px] flex-1">
                {formatRelative(r.startedAt)} · {duration(r.startedAt, r.endedAt)}
              </span>
              <Link
                href={`/automation-runs/${r.id}`}
                className="font-mono text-[10px] uppercase tracking-widest text-hive-amber hover:underline"
              >
                View →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
