"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmbeddedTerminal } from "@/components/EmbeddedTerminal";
import { ProjectTabs } from "@/components/project/ProjectTabs";
import type {
  AppConfigModel,
  NotificationRow,
  ProjectSnapshot,
  ReminderRow,
  SessionRow,
} from "@/lib/contracts";

const SPLIT_KEY = "hive:project-split";
const MIN_PCT = 25;
const MAX_PCT = 75;
const DEFAULT_PCT = 50;
const KEY_STEP = 2;
const KEY_STEP_LARGE = 10;

/** Space the shell reserves below the split: StatusBar (28px) + main's pb-6
 *  (24px). Everything ABOVE the split (TopBar, page header, paddings) is
 *  measured at runtime, so layout changes there can't break the height. */
const SHELL_BOTTOM_CHROME = 52;
const MIN_SPLIT_HEIGHT = 420;

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

function clamp(n: number): number {
  if (n < MIN_PCT) return MIN_PCT;
  if (n > MAX_PCT) return MAX_PCT;
  return n;
}

function persistPct(value: number) {
  try {
    window.localStorage.setItem(SPLIT_KEY, String(Math.round(value)));
  } catch {
    // ignore quota/permission errors
  }
}

function TerminalIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M4.5 6l2.5 2-2.5 2M8.5 10.5h3" />
    </svg>
  );
}

export function ProjectSplit({
  projectId,
  snapshot,
  sessions,
  reminders,
  notifications,
  engineModels,
  defaultEngineModel,
  activitySlot,
}: Props) {
  const [topPct, setTopPct] = useState<number>(DEFAULT_PCT);
  const [dragging, setDragging] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [splitHeight, setSplitHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topPctRef = useRef<number>(DEFAULT_PCT);

  // Restore the persisted split (deferred to avoid a synchronous setState in
  // the effect body — react-hooks/set-state-in-effect).
  useEffect(() => {
    const raw = window.localStorage.getItem(SPLIT_KEY);
    if (raw === null) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const frame = requestAnimationFrame(() => {
      const next = clamp(parsed);
      topPctRef.current = next;
      setTopPct(next);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Fill the viewport: measure where the split starts and give it the rest of
  // the screen (no magic "100vh - 200px" — header/TopBar changes are absorbed).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setSplitHeight(
        Math.max(MIN_SPLIT_HEIGHT, window.innerHeight - top - SHELL_BOTTOM_CHROME),
      );
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Pointer-based drag: works for mouse, touch and pen via pointer capture.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      const next = clamp(((e.clientY - rect.top) / rect.height) * 100);
      topPctRef.current = next;
      setTopPct(next);
    },
    [dragging],
  );

  const onPointerEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    persistPct(topPctRef.current);
  }, [dragging]);

  // Keyboard resize on the separator (arrows / PageUp / PageDown / Home / End).
  const onSeparatorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      if (e.key === "ArrowUp") next = clamp(topPct - KEY_STEP);
      else if (e.key === "ArrowDown") next = clamp(topPct + KEY_STEP);
      else if (e.key === "PageUp") next = clamp(topPct - KEY_STEP_LARGE);
      else if (e.key === "PageDown") next = clamp(topPct + KEY_STEP_LARGE);
      else if (e.key === "Home") next = MIN_PCT;
      else if (e.key === "End") next = MAX_PCT;
      if (next === null) return;
      e.preventDefault();
      topPctRef.current = next;
      setTopPct(next);
      persistPct(next);
    },
    [topPct],
  );

  const bottomPct = 100 - topPct;

  return (
    <>
      {/* Desktop / md+: vertical split with the terminal pinned to the bottom */}
      <div
        ref={containerRef}
        className={`hidden md:flex flex-col ${dragging ? "select-none" : ""}`}
        style={{
          height: splitHeight !== null ? `${splitHeight}px` : "calc(100dvh - 250px)",
        }}
      >
        <div
          id="project-split-top"
          className="min-h-0 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel"
          style={{ height: `calc(${topPct}% - 5px)` }}
        >
          <ProjectTabs
            projectId={projectId}
            snapshot={snapshot}
            sessions={sessions}
            reminders={reminders}
            notifications={notifications}
            engineModels={engineModels}
            defaultEngineModel={defaultEngineModel}
            activitySlot={activitySlot}
          />
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize terminal"
          aria-controls="project-split-top project-split-bottom"
          aria-valuenow={Math.round(topPct)}
          aria-valuemin={MIN_PCT}
          aria-valuemax={MAX_PCT}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onSeparatorKeyDown}
          className="group flex h-2.5 shrink-0 cursor-row-resize touch-none items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`h-1 w-10 rounded-full ${
              dragging ? "bg-primary" : "bg-border-strong group-hover:bg-primary group-focus-visible:bg-primary"
            }`}
          />
        </div>

        <div
          id="project-split-bottom"
          className="min-h-0 overflow-hidden"
          style={{ height: `calc(${bottomPct}% - 5px)` }}
        >
          <EmbeddedTerminal projectId={projectId} />
        </div>
      </div>

      {/* Mobile / <md: tabs only, terminal behind an overlay */}
      <div className="flex flex-col md:hidden">
        <div
          className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-bevel"
          style={{ minHeight: "60vh" }}
        >
          <ProjectTabs
            projectId={projectId}
            snapshot={snapshot}
            sessions={sessions}
            reminders={reminders}
            notifications={notifications}
            engineModels={engineModels}
            defaultEngineModel={defaultEngineModel}
            activitySlot={activitySlot}
          />
        </div>
        <button
          type="button"
          onClick={() => setTerminalOpen(true)}
          className="mt-3 inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-border bg-surface-2 px-4 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          <TerminalIcon />
          Open terminal
        </button>
        {terminalOpen ? (
          <div className="fixed inset-0 z-50 flex flex-col gap-2 bg-background p-3">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setTerminalOpen(false)}
                className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <EmbeddedTerminal projectId={projectId} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
