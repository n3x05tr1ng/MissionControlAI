"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { InlineFileEditor } from "@/components/editors/InlineFileEditor";
import { GitPanel } from "@/components/git/GitPanel";
import { GitStatusView } from "@/components/GitStatusView";
import { HandoffView } from "@/components/HandoffView";
import { RecentActivityPanel } from "@/components/RecentActivityPanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { RunPanel } from "@/components/RunPanel";
import { SessionTimeline } from "@/components/SessionTimeline";
import type {
  AppConfigModel,
  NotificationRow,
  ProjectSnapshot,
  ReminderRow,
  SessionRow,
} from "@/lib/contracts";

type TabKey = "overview" | "handoff" | "sessions" | "git";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "handoff", label: "Handoff" },
  { key: "sessions", label: "Sessions" },
  { key: "git", label: "Git" },
];

type Props = {
  projectId: string;
  snapshot: ProjectSnapshot;
  sessions: SessionRow[];
  reminders: ReminderRow[];
  notifications: NotificationRow[];
  engineModels: AppConfigModel[];
  defaultEngineModel: string;
  activitySlot: ReactNode;
};

function isTabKey(value: string | null): value is TabKey {
  return (
    value === "overview" ||
    value === "handoff" ||
    value === "sessions" ||
    value === "git"
  );
}

export function ProjectTabs({
  projectId,
  snapshot,
  sessions,
  reminders,
  notifications,
  engineModels,
  defaultEngineModel,
  activitySlot,
}: Props) {
  const storageKey = `hive:project-tab:${projectId}`;
  const [active, setActive] = useState<TabKey>("overview");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (isTabKey(saved)) setActive(saved);
  }, [storageKey]);

  const handleSelect = useCallback(
    (key: TabKey) => {
      setActive(key);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, key);
      }
    },
    [storageKey],
  );

  return (
    <div className="flex h-full flex-col">
      <nav className="sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-hive-border bg-hive-panel px-2">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSelect(tab.key)}
              className={
                "relative px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors " +
                (isActive
                  ? "text-hive-amber"
                  : "text-hive-muted hover:text-hive-text")
              }
            >
              {tab.label}
              {isActive ? (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-hive-amber" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {active === "overview" ? (
          <OverviewPanel
            projectId={projectId}
            snapshot={snapshot}
            reminders={reminders}
            notifications={notifications}
            engineModels={engineModels}
            defaultEngineModel={defaultEngineModel}
            activitySlot={activitySlot}
          />
        ) : null}
        {active === "handoff" ? (
          <section>
            <header className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
                [ HANDOFF ]
              </h2>
              <InlineFileEditor projectId={projectId} kind="handoff" />
            </header>
            <HandoffView handoff={snapshot.handoff} />
          </section>
        ) : null}
        {active === "sessions" ? <SessionTimeline sessions={sessions} /> : null}
        {active === "git" ? (
          <GitPanel projectId={projectId} initialBranch={snapshot.git?.branch} />
        ) : null}
      </div>
    </div>
  );
}

type OverviewProps = {
  projectId: string;
  snapshot: ProjectSnapshot;
  reminders: ReminderRow[];
  notifications: NotificationRow[];
  engineModels: AppConfigModel[];
  defaultEngineModel: string;
  activitySlot: ReactNode;
};

function OverviewPanel({
  projectId,
  snapshot,
  reminders,
  notifications,
  engineModels,
  defaultEngineModel,
  activitySlot,
}: OverviewProps) {
  const { state, git } = snapshot;

  return (
    <div className="flex flex-col gap-4">
      <RunPanel
        projectId={projectId}
        models={engineModels}
        defaultModel={defaultEngineModel}
      />

      {activitySlot}

      <section className="border border-hive-border bg-hive-panel">
        <header className="flex items-center justify-between gap-2 border-b border-hive-border px-4 py-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
            [ STATE ]
          </h2>
          <InlineFileEditor projectId={projectId} kind="state" />
        </header>
        <div className="divide-y divide-hive-border">
          <div className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Next step
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-hive-text/90">
              {state.nextStep?.trim() || "—"}
            </p>
          </div>
          <div className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Blockers
            </h3>
            {state.blockers.length === 0 ? (
              <p className="mt-1 text-sm text-hive-muted">—</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 text-sm text-hive-text/90">
                {state.blockers.map((b, i) => (
                  <li key={`${i}-${b}`}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
              Open questions
            </h3>
            {state.openQuestions.length === 0 ? (
              <p className="mt-1 text-sm text-hive-muted">—</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 text-sm text-hive-text/90">
                {state.openQuestions.map((q, i) => (
                  <li key={`${i}-${q}`}>{q}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <GitStatusView git={git} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RemindersPanel reminders={reminders} />
        <RecentActivityPanel notifications={notifications} />
      </div>
    </div>
  );
}

