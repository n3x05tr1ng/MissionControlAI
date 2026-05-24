import { HumanReviewForm } from "@/components/automations/HumanReviewForm";
import type {
  AutomationRun,
  AutomationRunEvent,
  AutomationStep,
} from "@/lib/contracts";
import { formatIso } from "@/lib/time";

type Props = {
  run: AutomationRun;
  steps: AutomationStep[];
};

function stepInfo(
  steps: AutomationStep[],
  stepId: string,
): { order: number; type: string } {
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { order: 0, type: "?" };
  return { order: idx + 1, type: steps[idx].type };
}

function colorFor(type: string): string {
  if (type === "review_agent") return "border-l-hive-cyan";
  if (type === "human_review") return "border-l-yellow-300";
  return "border-l-hive-amber";
}

function CollapsibleOutput({ text }: { text: string }) {
  if (text.length <= 800) {
    return (
      <pre className="mt-2 max-h-96 overflow-auto bg-hive-bg/60 p-2 font-mono text-[11px] text-hive-text/90 whitespace-pre-wrap">
        {text}
      </pre>
    );
  }
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-hive-muted hover:text-hive-text">
        Show full output ({text.length.toLocaleString()} chars)
      </summary>
      <pre className="mt-2 max-h-[60vh] overflow-auto bg-hive-bg/60 p-2 font-mono text-[11px] text-hive-text/90 whitespace-pre-wrap">
        {text}
      </pre>
    </details>
  );
}

export function RunTimeline({ run, steps }: Props) {
  if (run.events.length === 0) {
    return (
      <div className="border border-hive-border bg-hive-panel p-4">
        <p className="text-sm text-hive-muted">No events yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {run.events.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          steps={steps}
          runId={run.id}
        />
      ))}
    </div>
  );
}

function EventRow({
  event,
  steps,
  runId,
}: {
  event: AutomationRunEvent;
  steps: AutomationStep[];
  runId: string;
}) {
  const info = stepInfo(steps, event.stepId);
  const accent = colorFor(info.type);

  return (
    <article
      className={`border border-hive-border border-l-4 bg-hive-panel p-3 ${accent}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-text">
            Step {info.order}: {info.type.replace("_", " ")}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            attempt {event.attempt}
          </span>
          <StatusPill status={event.status} />
          {event.reviewVerdict ? (
            <VerdictPill verdict={event.reviewVerdict} />
          ) : null}
        </div>
        <span className="font-mono text-[10px] text-hive-muted">
          {formatIso(event.startedAt)}
        </span>
      </header>

      {event.agentOutput ? <CollapsibleOutput text={event.agentOutput} /> : null}

      {event.reviewFeedback ? (
        <p className="mt-2 border-l-2 border-hive-cyan/40 pl-2 text-xs text-hive-text/90">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
            Feedback:{" "}
          </span>
          {event.reviewFeedback}
        </p>
      ) : null}

      {event.status === "awaiting_human" && !event.endedAt ? (
        <HumanReviewForm runId={runId} />
      ) : null}
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "border-emerald-400/60 text-emerald-400"
      : status === "rejected"
        ? "border-red-400/60 text-red-400"
        : status === "error"
          ? "border-red-400/60 text-red-400"
          : status === "awaiting_human"
            ? "border-yellow-300/60 text-yellow-300"
            : "border-hive-amber/60 text-hive-amber";
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}
    >
      {status}
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: "approve" | "reject" }) {
  const cls =
    verdict === "approve"
      ? "border-emerald-400/60 text-emerald-400"
      : "border-red-400/60 text-red-400";
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}
    >
      {verdict === "approve" ? "APPROVED" : "REJECTED"}
    </span>
  );
}
