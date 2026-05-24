import type { ProjectStatus } from "@/lib/contracts";

type Props = {
  status: ProjectStatus;
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  idle: "text-hive-muted border-hive-border",
  running: "text-hive-amber border-hive-amber/50",
  "needs-input": "text-hive-cyan border-hive-cyan/50",
  blocked: "text-hive-red border-hive-red/50",
  done: "text-hive-green border-hive-green/50",
};

export function StatusBadge({ status }: Props) {
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.idle;
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cls}`}
    >
      {status}
    </span>
  );
}
