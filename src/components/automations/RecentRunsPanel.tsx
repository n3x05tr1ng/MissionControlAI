"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RunStatusBadge } from "@/components/automations/RunStatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AutomationRun } from "@/lib/contracts";
import { formatRelative } from "@/lib/time";

type Props = {
  automationId: string;
};

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
    <section className="hive-card animate-enter overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-[12px] font-medium text-muted-foreground">
          Recent runs
        </h2>
        {error ? (
          <span className="font-mono text-[11px] text-faint" title={error}>
            API not ready
          </span>
        ) : null}
      </header>

      {runs === null ? (
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : runs.length === 0 ? (
        <p className="p-4 text-[13px] text-muted-foreground">
          No runs yet. Use “Run now” above to start the first one.
        </p>
      ) : (
        <ul className="stagger-children divide-y divide-border">
          {runs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/automation-runs/${r.id}`}
                className="group flex min-h-11 items-center gap-3 px-4 py-1.5 hover:bg-surface-2"
              >
                <RunStatusBadge status={r.status} />
                <span className="flex-1 truncate font-mono text-[12px] text-muted-foreground">
                  {formatRelative(r.startedAt)} ·{" "}
                  {duration(r.startedAt, r.endedAt)}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {r.triggeredBy}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  className="text-faint group-hover:text-foreground"
                >
                  <path
                    d="m5 3.5 4 3.5-4 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
