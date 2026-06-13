import type {
  AutomationEventStatus,
  AutomationRunStatus,
} from "@/lib/contracts";

// Pills de estado de runs/eventos: fondo `*-soft` + texto del color vivo + dot,
// mismo patrón que StatusBadge (ver DESIGN_NOTES §4).
export type RunBadgeStatus = AutomationRunStatus | AutomationEventStatus;

type BadgeSpec = {
  label: string;
  pill: string;
  dot: string;
};

const SPECS: Record<RunBadgeStatus, BadgeSpec> = {
  pending: {
    label: "pending",
    pill: "border-border bg-surface-2 text-muted-foreground",
    dot: "bg-faint",
  },
  running: {
    label: "running",
    pill: "border-transparent bg-primary-soft text-primary",
    dot: "bg-primary animate-pulse",
  },
  awaiting_human: {
    label: "awaiting human",
    pill: "border-transparent bg-warning-soft text-warning",
    dot: "bg-warning animate-pulse",
  },
  done: {
    label: "done",
    pill: "border-transparent bg-success-soft text-success",
    dot: "bg-success",
  },
  success: {
    label: "success",
    pill: "border-transparent bg-success-soft text-success",
    dot: "bg-success",
  },
  rejected: {
    label: "rejected",
    pill: "border-transparent bg-destructive-soft text-destructive",
    dot: "bg-destructive",
  },
  error: {
    label: "error",
    pill: "border-transparent bg-destructive-soft text-destructive",
    dot: "bg-destructive",
  },
};

export function RunStatusBadge({ status }: { status: RunBadgeStatus }) {
  const spec = SPECS[status] ?? SPECS.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${spec.pill}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${spec.dot}`}
        aria-hidden="true"
      />
      {spec.label}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: "approve" | "reject" }) {
  const approved = verdict === "approve";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] font-medium ${
        approved
          ? "bg-success-soft text-success"
          : "bg-destructive-soft text-destructive"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${approved ? "bg-success" : "bg-destructive"}`}
        aria-hidden="true"
      />
      {approved ? "approved" : "rejected"}
    </span>
  );
}
