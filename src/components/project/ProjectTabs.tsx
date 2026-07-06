"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  // This component mounts twice per page (desktop split + mobile layout), so
  // DOM ids need a per-instance suffix to stay unique.
  const uid = useId();
  const [active, setActive] = useState<TabKey>("overview");
  const tabRefs = useRef<Map<TabKey, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!isTabKey(saved)) return;
    // Deferred restore: avoids a synchronous setState inside the effect body
    // (react-hooks/set-state-in-effect) while still applying the saved tab.
    const frame = requestAnimationFrame(() => setActive(saved));
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const handleSelect = useCallback(
    (key: TabKey) => {
      setActive(key);
      try {
        window.localStorage.setItem(storageKey, key);
      } catch {
        // ignore quota/permission errors
      }
    },
    [storageKey],
  );

  // Tabs ARIA pattern: roving tabindex + arrow-key navigation
  // (selection follows focus).
  const onTablistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = TABS.findIndex((t) => t.key === active);
      let next: number | null = null;
      if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
      else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = TABS.length - 1;
      if (next === null) return;
      e.preventDefault();
      const key = TABS[next].key;
      handleSelect(key);
      tabRefs.current.get(key)?.focus();
    },
    [active, handleSelect],
  );

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="Project sections"
        onKeyDown={onTablistKeyDown}
        className="flex shrink-0 items-center gap-1 border-b border-border bg-surface-1/80 px-2"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
                else tabRefs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              id={`project-tab-${tab.key}-${uid}`}
              aria-selected={isActive}
              aria-controls={`project-panel-${tab.key}-${uid}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSelect(tab.key)}
              className={`relative rounded-t-md px-3 py-2.5 text-[13px] font-medium ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {isActive ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        key={active}
        role="tabpanel"
        id={`project-panel-${active}-${uid}`}
        aria-labelledby={`project-tab-${active}-${uid}`}
        tabIndex={0}
        className="animate-enter min-h-0 flex-1 overflow-auto p-4"
      >
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
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium text-foreground">
                Handoff
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

/* ------------------------- collapsible section --------------------------- */

type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean;
  /** Small badges shown next to the title (visible even when collapsed). */
  meta?: ReactNode;
  /** Right-aligned actions; clicks there never toggle the section. */
  actions?: ReactNode;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  defaultOpen = false,
  meta,
  actions,
  children,
}: CollapsibleProps) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 rounded-md px-1 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-faint transition-transform group-open:rotate-90"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span>{title}</span>
        {meta}
        {actions ? (
          <span
            className="ml-auto"
            // Keep action clicks from toggling the <details>.
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {actions}
          </span>
        ) : null}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/* ------------------------------ overview --------------------------------- */

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
  const blockerCount = state.blockers.length;
  const questionCount = state.openQuestions.length;

  return (
    <div className="flex flex-col gap-4">
      {/* The run panel is the protagonist of the overview. */}
      <RunPanel
        projectId={projectId}
        models={engineModels}
        defaultModel={defaultEngineModel}
      />

      <CollapsibleSection
        title="Current state"
        defaultOpen
        meta={
          <>
            {blockerCount > 0 ? (
              <span className="rounded-full bg-destructive-soft px-2 py-0.5 font-mono text-[11px] text-destructive">
                {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {questionCount > 0 ? (
              <span className="rounded-full bg-info-soft px-2 py-0.5 font-mono text-[11px] text-info">
                {questionCount} question{questionCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </>
        }
        actions={<InlineFileEditor projectId={projectId} kind="state" />}
      >
        <div className="divide-y divide-border rounded-lg border border-border bg-surface-1 shadow-bevel">
          <div className="p-4">
            <h3 className="text-[12px] font-medium text-muted-foreground">
              Next step
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {state.nextStep?.trim() || "—"}
            </p>
          </div>
          <div className="p-4">
            <h3 className="text-[12px] font-medium text-muted-foreground">
              Blockers
            </h3>
            {blockerCount === 0 ? (
              <p className="mt-1 text-[13px] text-faint">None</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 text-[13px] leading-relaxed text-foreground/90">
                {state.blockers.map((b, i) => (
                  <li key={`${i}-${b}`}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-[12px] font-medium text-muted-foreground">
              Open questions
            </h3>
            {questionCount === 0 ? (
              <p className="mt-1 text-[13px] text-faint">None</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 text-[13px] leading-relaxed text-foreground/90">
                {state.openQuestions.map((q, i) => (
                  <li key={`${i}-${q}`}>{q}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Repository">
        <GitStatusView git={git} />
      </CollapsibleSection>

      <CollapsibleSection title="Activity & stats">
        {activitySlot}
      </CollapsibleSection>

      <CollapsibleSection title="Reminders & recent activity">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RemindersPanel reminders={reminders} />
          <RecentActivityPanel notifications={notifications} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
