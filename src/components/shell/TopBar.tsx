import Link from "next/link";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
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
  green: "bg-success",
  amber: "bg-primary",
  muted: "bg-faint",
};

function Pill({ label, value, tone = "muted", href }: PillProps) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border bg-surface-1/60 px-3 font-mono text-[11px] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[tone]}`} />
      <span>{label}</span>
      <span className="text-foreground/70">{value}</span>
      {href ? (
        <Link
          href={href}
          className="ml-0.5 text-primary underline-offset-2 hover:text-primary-hover hover:underline"
        >
          fix
        </Link>
      ) : null}
    </span>
  );
}

// Titlebar integrada de 48px: continua con el fondo del shell, sin línea
// divisoria. Las páginas ponen su propio H1 con <PageHeader />.
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
    <header className="flex h-12 shrink-0 items-center justify-end gap-2 px-4">
      <Pill label="scheduler" value={schedulerValue} tone={schedulerTone} />
      <Pill
        label="anthropic"
        value={anthropicValue}
        tone={anthropicTone}
        href={anthropicReady ? undefined : "/settings"}
      />
      <ThemeToggle />
    </header>
  );
}
