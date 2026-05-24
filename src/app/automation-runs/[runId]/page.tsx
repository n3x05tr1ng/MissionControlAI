import Link from "next/link";
import { notFound } from "next/navigation";

import { FinalOutputPanel } from "@/components/automations/FinalOutputPanel";
import { RunAutoRefresh } from "@/components/automations/RunAutoRefresh";
import { RunStopButton } from "@/components/automations/RunStopButton";
import { RunTimeline } from "@/components/automations/RunTimeline";
import type { Automation, AutomationRun } from "@/lib/contracts";
import { getAutomation } from "@/lib/repos/automations";
import { getRun } from "@/lib/repos/automationRuns";
import { formatIso, formatRelative } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ runId: string }>;

function safeGetRun(runId: string): AutomationRun | null {
  try {
    return getRun(runId);
  } catch {
    return null;
  }
}

function safeGetAutomation(id: string): Automation | null {
  try {
    return getAutomation(id);
  } catch {
    return null;
  }
}

function statusClass(status: AutomationRun["status"]): string {
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

export default async function AutomationRunPage({
  params,
}: {
  params: Params;
}) {
  const { runId } = await params;
  const run = safeGetRun(runId);
  if (!run) notFound();
  const automation = safeGetAutomation(run.automationId);

  const isLive = run.status === "running" || run.status === "awaiting_human";

  return (
    <section className="max-w-[1400px] flex flex-col gap-5">
      <RunAutoRefresh runId={runId} active={isLive} />

      <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        <Link href="/automations" className="hover:text-hive-amber">
          ← Automations
        </Link>
        {automation ? (
          <>
            <span>/</span>
            <Link
              href={`/automations/${automation.id}`}
              className="hover:text-hive-amber"
            >
              {automation.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="flex flex-col gap-3 border border-hive-border bg-hive-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-sans text-xl text-hive-text">
              {automation?.name ?? "Run"}{" "}
              <span className="font-mono text-xs text-hive-muted">
                · {run.id.slice(0, 8)}
              </span>
            </h1>
            <p className="mt-1 font-mono text-[11px] text-hive-muted">
              started {formatRelative(run.startedAt)} ({formatIso(run.startedAt)})
              {run.endedAt
                ? ` · ended ${formatRelative(run.endedAt)}`
                : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${statusClass(run.status)}`}
            >
              {run.status}
            </span>
            {isLive ? <RunStopButton runId={run.id} /> : null}
          </div>
        </div>
        {run.error ? (
          <p className="border border-red-400/40 bg-red-400/5 px-2 py-1 font-mono text-xs text-red-400">
            {run.error}
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ TIMELINE ]
        </h2>
        <RunTimeline run={run} steps={automation?.steps ?? []} />
      </section>

      {run.status === "done" && run.finalOutput ? (
        <FinalOutputPanel output={run.finalOutput} />
      ) : null}
    </section>
  );
}
