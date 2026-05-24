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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(SPLIT_KEY);
    if (raw === null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) setTopPct(clamp(parsed));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(ev: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rel = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopPct(clamp(rel));
    }
    function onUp() {
      setDragging(false);
      setTopPct((current) => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SPLIT_KEY, String(Math.round(current)));
        }
        return current;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const bottomPct = 100 - topPct;

  return (
    <>
      {/* Desktop / md+: vertical split with terminal pinned to bottom */}
      <div
        ref={containerRef}
        className="hidden md:flex flex-col border border-hive-border bg-hive-bg select-none"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={{ height: `${topPct}%` }}
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
          onMouseDown={onMouseDown}
          className={
            "shrink-0 h-1.5 cursor-row-resize border-y border-hive-border bg-hive-panel hover:bg-hive-amber/40 transition-colors " +
            (dragging ? "bg-hive-amber/60" : "")
          }
        />

        <div
          className="min-h-0 overflow-hidden"
          style={{ height: `${bottomPct}%` }}
        >
          <EmbeddedTerminal projectId={projectId} />
        </div>
      </div>

      {/* Mobile / <md: tabs only, terminal hidden behind overlay */}
      <div className="md:hidden flex flex-col">
        <div className="border border-hive-border" style={{ minHeight: "60vh" }}>
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
          className="mt-2 self-start font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:underline"
        >
          Open terminal
        </button>
        {terminalOpen ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-hive-bg">
            <div className="flex items-center justify-between border-b border-hive-border bg-hive-panel px-3 py-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-hive-amber">
                Terminal
              </span>
              <button
                type="button"
                onClick={() => setTerminalOpen(false)}
                className="font-mono text-[11px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <EmbeddedTerminal projectId={projectId} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
