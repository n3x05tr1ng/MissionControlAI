import Link from "next/link";

import { getSchedulerStatus } from "@/lib/scheduler";
import { hasAnthropicKey } from "@/lib/settings";

type Tone = "green" | "amber" | "muted";

type PillProps = {
  label: string;
  value: string;
  tone?: Tone;
  href?: string;
};

const DOT_TONE: Record<Tone, string> = {
  green: "bg-emerald-400",
  amber: "bg-hive-amber",
  muted: "bg-hive-muted",
};

function Pill({ label, value, tone = "muted", href }: PillProps) {
  const body = (
    <span className="inline-flex items-center gap-2 border border-hive-border bg-hive-bg/40 px-2 py-1 font-mono text-[11px] text-hive-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[tone]}`} />
      <span className="uppercase tracking-wider">{label}</span>
      <span className="text-hive-text/70">{value}</span>
      {href ? (
        <Link
          href={href}
          className="ml-1 text-hive-amber/80 hover:text-hive-amber underline-offset-2 hover:underline"
        >
          fix
        </Link>
      ) : null}
    </span>
  );
  return body;
}

export async function TopBar() {
  const scheduler = getSchedulerStatus();
  const anthropicReady = hasAnthropicKey();

  const schedulerTone: Tone = scheduler.running ? "green" : "muted";
  const schedulerValue = scheduler.running
    ? `running (${scheduler.jobs} job${scheduler.jobs === 1 ? "" : "s"})`
    : "idle";

  const anthropicTone: Tone = anthropicReady ? "green" : "amber";
  const anthropicValue = anthropicReady ? "configured" : "not configured";

  return (
    <header className="h-12 flex items-center justify-between border-b border-hive-border bg-hive-panel px-4">
      <div className="flex items-center gap-2 font-mono text-xs text-hive-muted" />
      <div className="flex items-center gap-2">
        <Pill label="scheduler" value={schedulerValue} tone={schedulerTone} />
        <Pill
          label="anthropic"
          value={anthropicValue}
          tone={anthropicTone}
          href={anthropicReady ? undefined : "/settings"}
        />
      </div>
    </header>
  );
}
