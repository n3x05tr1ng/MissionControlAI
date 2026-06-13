import { HumanReviewForm } from "@/components/automations/HumanReviewForm";
import {
  RunStatusBadge,
  VerdictBadge,
} from "@/components/automations/RunStatusBadge";
import type {
  AutomationEventStatus,
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

// Dot del timeline según estado del evento (tokens semánticos).
function dotClass(status: AutomationEventStatus): string {
  switch (status) {
    case "success":
      return "bg-success";
    case "rejected":
    case "error":
      return "bg-destructive";
    case "awaiting_human":
      return "bg-warning animate-pulse";
    default:
      return "bg-primary animate-pulse";
  }
}

function CollapsibleOutput({ text }: { text: string }) {
  if (text.length <= 800) {
    return (
      <pre className="mt-2.5 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-2.5 font-mono text-[12px] leading-relaxed text-foreground/90">
        {text}
      </pre>
    );
  }
  return (
    <details className="mt-2.5">
      <summary className="cursor-pointer text-[12px] font-medium text-faint hover:text-foreground">
        Show full output ({text.length.toLocaleString()} chars)
      </summary>
      <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-2.5 font-mono text-[12px] leading-relaxed text-foreground/90">
        {text}
      </pre>
    </details>
  );
}

export function RunTimeline({ run, steps }: Props) {
  if (run.events.length === 0) {
    return (
      <div className="hive-card animate-enter p-6 text-center">
        <p className="text-[13px] text-muted-foreground">No events yet.</p>
      </div>
    );
  }

  return (
    <ol className="stagger-children flex flex-col" aria-label="Run events">
      {run.events.map((event, idx) => (
        <EventRow
          key={event.id}
          event={event}
          steps={steps}
          runId={run.id}
          isLast={idx === run.events.length - 1}
        />
      ))}
    </ol>
  );
}

function EventRow({
  event,
  steps,
  runId,
  isLast,
}: {
  event: AutomationRunEvent;
  steps: AutomationStep[];
  runId: string;
  isLast: boolean;
}) {
  const info = stepInfo(steps, event.stepId);

  return (
    <li className={`flex gap-3 ${isLast ? "" : "pb-3"}`}>
      {/* Riel: dot de estado + conector hairline */}
      <div className="flex flex-col items-center pt-3.5" aria-hidden="true">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(event.status)}`}
        />
        {isLast ? null : <span className="mt-1.5 w-px flex-1 bg-border" />}
      </div>

      <article className="min-w-0 flex-1 rounded-lg border border-border bg-surface-1 p-3 shadow-bevel">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">
              Step {info.order}: {info.type.replace("_", " ")}
            </span>
            <span className="font-mono text-[11px] text-faint">
              attempt {event.attempt}
            </span>
            <RunStatusBadge status={event.status} />
            {event.reviewVerdict ? (
              <VerdictBadge verdict={event.reviewVerdict} />
            ) : null}
          </div>
          <time
            dateTime={event.startedAt}
            className="font-mono text-[11px] text-faint"
          >
            {formatIso(event.startedAt)}
          </time>
        </header>

        {event.agentOutput ? (
          <CollapsibleOutput text={event.agentOutput} />
        ) : null}

        {event.reviewFeedback ? (
          <p className="mt-2.5 border-l-2 border-info/40 pl-2.5 text-[13px] leading-relaxed text-foreground/90">
            <span className="text-[12px] font-medium text-info">
              Feedback:{" "}
            </span>
            {event.reviewFeedback}
          </p>
        ) : null}

        {event.status === "awaiting_human" && !event.endedAt ? (
          <HumanReviewForm runId={runId} />
        ) : null}
      </article>
    </li>
  );
}
