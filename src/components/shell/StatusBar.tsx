import { BRAND } from "@/lib/brand";
import { getSchedulerStatus } from "@/lib/scheduler";
import { formatRelative } from "@/lib/time";

export async function StatusBar() {
  const now = new Date().toISOString();
  const { lastTickAt } = getSchedulerStatus();
  const tickLabel = lastTickAt
    ? `scheduler: last tick ${formatRelative(lastTickAt)}`
    : "scheduler: warming up";

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-surface-1/60 px-3 font-mono text-[11px] text-faint backdrop-blur-md">
      <span className="text-primary/80">{`${BRAND.name} v${BRAND.version}`}</span>
      <span className="hidden text-muted-foreground md:inline">{tickLabel}</span>
      <time dateTime={now} className="tabular-nums">
        {now}
      </time>
    </footer>
  );
}
