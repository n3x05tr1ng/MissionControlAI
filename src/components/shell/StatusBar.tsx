import { getSchedulerStatus } from "@/lib/scheduler";
import { formatRelative } from "@/lib/time";

export async function StatusBar() {
  const now = new Date().toISOString();
  const { lastTickAt } = getSchedulerStatus();
  const tickLabel = lastTickAt
    ? `scheduler: last tick ${formatRelative(lastTickAt)}`
    : "scheduler: warming up";

  return (
    <footer className="h-7 flex items-center justify-between border-t border-hive-border bg-hive-panel px-3 font-mono text-xs text-hive-muted">
      <span className="text-hive-amber/80">Hive v0.1.0</span>
      <span className="hidden md:inline text-hive-text/60">{tickLabel}</span>
      <time dateTime={now}>{now}</time>
    </footer>
  );
}
