import Link from "next/link";

import { ProfileIcon } from "@/components/icons/ProfileIcons";
import type { Automation, AutomationRunStatus } from "@/lib/contracts";
import { describeCron } from "@/lib/tasks/cronPresets";
import { formatIso, formatRelative } from "@/lib/time";

export type LastRunSummary = {
  status: AutomationRunStatus;
  startedAt: string;
  endedAt: string | null;
};

type Props = {
  automation: Automation;
  lastRun?: LastRunSummary | null;
};

// Indicador de salud por tokens: verde (done), rojo (error), ámbar (en curso).
function healthFor(run: LastRunSummary | null | undefined): {
  dot: string;
  text: string;
  label: string;
} {
  if (!run) {
    return { dot: "bg-faint", text: "text-faint", label: "never run" };
  }
  switch (run.status) {
    case "done":
      return { dot: "bg-success", text: "text-success", label: "done" };
    case "error":
      return {
        dot: "bg-destructive",
        text: "text-destructive",
        label: "failed",
      };
    case "awaiting_human":
      return {
        dot: "bg-warning animate-pulse",
        text: "text-warning",
        label: "awaiting human",
      };
    default:
      return {
        dot: "bg-primary animate-pulse",
        text: "text-primary",
        label: "running",
      };
  }
}

export function AutomationCard({ automation, lastRun }: Props) {
  const description = automation.description ?? "";
  const schedule = automation.schedule
    ? describeCron(automation.schedule)
    : null;
  const health = healthFor(lastRun);

  return (
    <Link
      href={`/automations/${automation.id}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel hover:-translate-y-0.5 hover:border-border-strong"
    >
      {/* Acento integrado: borde izquierdo + glow suave del color de la entidad */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: automation.color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full opacity-[0.12] blur-2xl group-hover:opacity-20"
        style={{ background: automation.color }}
      />

      {automation.isTemplate ? (
        <span className="absolute right-3 top-3 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          Template
        </span>
      ) : null}

      <div className="flex items-start gap-3 p-4 pl-5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border"
          style={{
            color: automation.color,
            background: `color-mix(in srgb, ${automation.color} 12%, transparent)`,
          }}
        >
          <ProfileIcon name={automation.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {automation.name}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-faint">No description</p>
          )}
        </div>
      </div>

      {/* Última ejecución + salud */}
      <div className="flex items-center gap-2 px-4 pb-3 pl-5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${health.dot}`}
          aria-hidden="true"
        />
        {lastRun ? (
          <span
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={formatIso(lastRun.startedAt)}
          >
            Last run {formatRelative(lastRun.startedAt)} ·{" "}
            <span className={health.text}>{health.label}</span>
          </span>
        ) : (
          <span className="font-mono text-[11px] text-faint">
            Never run yet
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 pl-5 font-mono text-[11px] text-faint">
        <span>
          {automation.steps.length} step
          {automation.steps.length === 1 ? "" : "s"}
        </span>
        {schedule ? (
          <span
            className="truncate text-muted-foreground"
            title={automation.schedule ?? schedule}
          >
            {schedule}
          </span>
        ) : (
          <span>manual</span>
        )}
        <span className={automation.enabled ? "text-success" : "text-faint"}>
          {automation.enabled ? "on" : "off"}
        </span>
      </div>
    </Link>
  );
}
