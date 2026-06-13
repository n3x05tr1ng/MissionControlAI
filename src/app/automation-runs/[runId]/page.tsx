import Link from "next/link";
import { notFound } from "next/navigation";

import { FinalOutputPanel } from "@/components/automations/FinalOutputPanel";
import { RunAutoRefresh } from "@/components/automations/RunAutoRefresh";
import { RunStatusBadge } from "@/components/automations/RunStatusBadge";
import { RunStopButton } from "@/components/automations/RunStopButton";
import { RunTimeline } from "@/components/automations/RunTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
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
  const meta = [
    `Run ${run.id.slice(0, 8)}`,
    `started ${formatRelative(run.startedAt)} (${formatIso(run.startedAt)})`,
    run.endedAt ? `ended ${formatRelative(run.endedAt)}` : null,
    `triggered ${run.triggeredBy === "manual" ? "manually" : `by ${run.triggeredBy}`}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mx-auto max-w-5xl">
      <RunAutoRefresh runId={runId} active={isLive} />

      <nav
        aria-label="Breadcrumb"
        className="animate-enter mb-4 flex items-center gap-1.5 text-[12px] text-faint"
      >
        <Link href="/automations" className="hover:text-foreground">
          Automations
        </Link>
        {automation ? (
          <>
            <span aria-hidden="true">/</span>
            <Link
              href={`/automations/${automation.id}`}
              className="truncate hover:text-foreground"
            >
              {automation.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="font-mono text-muted-foreground">
          {run.id.slice(0, 8)}
        </span>
      </nav>

      <PageHeader
        overline="Automation Run"
        title={automation?.name ?? "Run"}
        description={meta}
        actions={
          <>
            <RunStatusBadge status={run.status} />
            {isLive ? <RunStopButton runId={run.id} /> : null}
          </>
        }
      />

      {run.error ? (
        <p className="animate-enter mb-6 rounded-md border border-destructive/40 bg-destructive-soft px-3 py-2 font-mono text-xs text-destructive">
          {run.error}
        </p>
      ) : null}

      <section aria-label="Run timeline" className="mb-6">
        <h2 className="mb-3 text-[13px] font-medium text-foreground">
          Timeline
        </h2>
        <RunTimeline run={run} steps={automation?.steps ?? []} />
      </section>

      {run.status === "done" && run.finalOutput ? (
        <FinalOutputPanel output={run.finalOutput} />
      ) : null}
    </section>
  );
}
