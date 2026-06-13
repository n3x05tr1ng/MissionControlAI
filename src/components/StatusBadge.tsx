import type { ProjectStatus } from "@/lib/contracts";

type Props = {
  status: ProjectStatus;
};

// Badges de estado con tokens semánticos -soft (fondo) + color vivo (texto).
const STATUS_CLASS: Record<ProjectStatus, string> = {
  idle: "border-border bg-surface-2 text-muted-foreground",
  running: "border-transparent bg-primary-soft text-primary",
  "needs-input": "border-transparent bg-info-soft text-info",
  blocked: "border-transparent bg-destructive-soft text-destructive",
  done: "border-transparent bg-success-soft text-success",
};

const DOT_CLASS: Record<ProjectStatus, string> = {
  idle: "bg-faint",
  running: "bg-primary animate-pulse",
  "needs-input": "bg-info",
  blocked: "bg-destructive",
  done: "bg-success",
};

export function StatusBadge({ status }: Props) {
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.idle;
  const dot = DOT_CLASS[status] ?? DOT_CLASS.idle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
