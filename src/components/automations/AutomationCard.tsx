import Link from "next/link";

import { ProfileIcon } from "@/components/icons/ProfileIcons";
import type { Automation } from "@/lib/contracts";
import { describeCron } from "@/lib/tasks/cronPresets";

type Props = {
  automation: Automation;
};

export function AutomationCard({ automation }: Props) {
  const description = automation.description ?? "";
  const schedule = automation.schedule
    ? describeCron(automation.schedule)
    : null;

  return (
    <Link
      href={`/automations/${automation.id}`}
      className="group relative flex flex-col border border-hive-border bg-hive-panel hover:border-hive-amber/60 transition-colors"
    >
      <div
        className="h-3 w-full"
        style={{ backgroundColor: automation.color }}
        aria-hidden="true"
      />
      {automation.isTemplate ? (
        <span className="absolute right-2 top-5 font-mono text-[9px] uppercase tracking-widest text-hive-muted border border-hive-border bg-hive-bg/60 px-1.5 py-0.5">
          TEMPLATE
        </span>
      ) : null}
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center border border-hive-border"
          style={{ color: automation.color }}
        >
          <ProfileIcon name={automation.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base text-hive-text group-hover:text-hive-amber transition-colors truncate">
            {automation.name}
          </h3>
          <p
            className="mt-1 text-xs text-hive-muted overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-hive-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        <span>{automation.steps.length} step{automation.steps.length === 1 ? "" : "s"}</span>
        {schedule ? (
          <span className="text-hive-cyan truncate" title={schedule}>
            {schedule}
          </span>
        ) : (
          <span className="text-hive-muted">manual</span>
        )}
        <span className={automation.enabled ? "text-hive-amber" : "text-hive-muted"}>
          {automation.enabled ? "on" : "off"}
        </span>
      </div>
    </Link>
  );
}
