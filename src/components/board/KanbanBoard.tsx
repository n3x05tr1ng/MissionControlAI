"use client";

import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import {
  TASK_STATUSES,
  type ProjectConfig,
  type TaskRow,
  type TaskStatus,
} from "@/lib/contracts";

import { Column } from "./Column";
import { EditTaskModal } from "./EditTaskModal";
import { NewTaskModal } from "./NewTaskModal";

const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: "BACKLOG",
  ready: "READY",
  running: "RUNNING",
  review: "REVIEW",
  done: "DONE",
};

type Props = {
  projectId?: string;
  compact?: boolean;
};

type StreamFrame =
  | { type: "snapshot"; tasks: TaskRow[] }
  | { type: "task.created"; task: TaskRow }
  | { type: "task.updated"; task: TaskRow }
  | { type: "task.deleted"; id: string };

function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

// Dedup window for echoes of our own optimistic mutations.
const LOCAL_ECHO_MS = 500;

export function KanbanBoard({ projectId, compact }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recurrenceFilter, setRecurrenceFilter] = useState<
    "all" | "recurring" | "one-shot"
  >("all");
  const tasksRef = useRef<TaskRow[]>([]);
  tasksRef.current = tasks;

  // Track recent local-origin mutations by task id so the SSE echo can be
  // ignored briefly and not clobber our optimistic state.
  const recentLocalActions = useRef<Map<string, number>>(new Map());

  const markLocal = useCallback((id: string) => {
    recentLocalActions.current.set(id, Date.now());
  }, []);

  const isRecentLocal = useCallback((id: string): boolean => {
    const ts = recentLocalActions.current.get(id);
    if (!ts) return false;
    if (Date.now() - ts > LOCAL_ECHO_MS) {
      recentLocalActions.current.delete(id);
      return false;
    }
    return true;
  }, []);

  const projectsById = useMemo(() => {
    const map: Record<string, ProjectConfig> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const fetchProjects = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const snaps = (await res.json()) as Array<{ config: ProjectConfig }>;
      setProjects(snaps.map((s) => s.config));
    } catch {
      // ignore
    }
  }, []);

  const filterForProject = useCallback(
    (incoming: TaskRow[]): TaskRow[] => {
      if (!projectId) return incoming;
      return incoming.filter((t) => t.project_id === projectId);
    },
    [projectId],
  );

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // SSE subscription (replaces 4s polling). Fallback to a single fetch if
  // EventSource is unavailable (older browsers / SSR).
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (typeof window.EventSource === "undefined") {
      void (async () => {
        try {
          const url = projectId
            ? `/api/tasks?projectId=${encodeURIComponent(projectId)}`
            : "/api/tasks";
          const res = await fetch(url);
          if (res.ok) {
            const data = (await res.json()) as TaskRow[];
            setTasks(data);
          }
        } finally {
          setHydrated(true);
        }
      })();
      return;
    }

    const es = new EventSource("/api/tasks/stream");

    function applyFrame(frame: StreamFrame) {
      if (frame.type === "snapshot") {
        setTasks(filterForProject(frame.tasks));
        setHydrated(true);
        return;
      }
      if (frame.type === "task.created" || frame.type === "task.updated") {
        const incoming = frame.task;
        if (projectId && incoming.project_id !== projectId) return;
        if (isRecentLocal(incoming.id)) return;
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === incoming.id);
          if (idx < 0) return [...prev, incoming];
          const next = prev.slice();
          next[idx] = incoming;
          return next;
        });
        return;
      }
      if (frame.type === "task.deleted") {
        if (isRecentLocal(frame.id)) return;
        setTasks((prev) => prev.filter((t) => t.id !== frame.id));
      }
    }

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as StreamFrame;
        applyFrame(parsed);
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      // Browser auto-reconnects; mark hydrated so spinners go away.
      setHydrated(true);
    };

    return () => {
      es.close();
    };
  }, [projectId, filterForProject, isRecentLocal]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!showTemplates && t.recurring_template === 1) return false;
      const isRecurring =
        t.recurring_template === 1 || t.schedule !== null;
      if (recurrenceFilter === "recurring" && !isRecurring) return false;
      if (recurrenceFilter === "one-shot" && isRecurring) return false;
      return true;
    });
  }, [tasks, showTemplates, recurrenceFilter]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskRow[]> = {
      backlog: [],
      ready: [],
      running: [],
      review: [],
      done: [],
    };
    for (const t of visibleTasks) {
      grouped[t.status].push(t);
    }
    for (const s of TASK_STATUSES) {
      grouped[s].sort((a, b) => a.sort_order - b.sort_order);
    }
    return grouped;
  }, [visibleTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function findTaskById(id: string): TaskRow | undefined {
    return tasksRef.current.find((t) => t.id === id);
  }

  function resolveTargetColumn(overId: string): TaskStatus | null {
    if (isTaskStatus(overId)) return overId;
    const overTask = findTaskById(overId);
    return overTask ? overTask.status : null;
  }

  async function onDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const moving = findTaskById(activeId);
    if (!moving) return;

    const toStatus = resolveTargetColumn(overId);
    if (!toStatus) return;

    const columnTasks = tasksRef.current
      .filter((t) => t.status === toStatus)
      .sort((a, b) => a.sort_order - b.sort_order);

    let toIndex: number;
    if (isTaskStatus(overId)) {
      toIndex = columnTasks.length;
    } else {
      const idx = columnTasks.findIndex((t) => t.id === overId);
      toIndex = idx >= 0 ? idx : columnTasks.length;
    }

    if (moving.status === toStatus) {
      const currentIdx = columnTasks.findIndex((t) => t.id === activeId);
      if (currentIdx === toIndex) return;
    }

    const previous = tasksRef.current;
    const others = previous.filter((t) => t.id !== activeId);
    const targetCol = others.filter((t) => t.status === toStatus);
    const insertAt = Math.min(toIndex, targetCol.length);
    const newOrder = computeOptimisticOrder(targetCol, insertAt);
    const updatedMoving: TaskRow = {
      ...moving,
      status: toStatus,
      sort_order: newOrder,
    };
    setTasks([...others, updatedMoving]);
    markLocal(activeId);

    try {
      const res = await fetch("/api/tasks/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, toStatus, toIndex }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Move failed" }));
        throw new Error(j.error ?? "Move failed");
      }
    } catch (err) {
      setTasks(previous);
      notify.error(`Move failed: ${(err as Error).message}`);
    }
  }

  function computeOptimisticOrder(col: TaskRow[], index: number): number {
    const prev = index > 0 ? col[index - 1] : null;
    const next = index < col.length ? col[index] : null;
    if (prev && next) return (prev.sort_order + next.sort_order) / 2;
    if (prev) return prev.sort_order + 1;
    if (next) return next.sort_order - 1;
    return 1;
  }

  const filterChips: Array<{ id: "all" | "recurring" | "one-shot"; label: string }> = [
    { id: "all", label: "All" },
    { id: "recurring", label: "Recurring" },
    { id: "one-shot", label: "One-shot" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {filterChips.map((chip) => {
              const active = recurrenceFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setRecurrenceFilter(chip.id)}
                  className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-1 transition-colors ${
                    active
                      ? "border-hive-amber bg-hive-amber/10 text-hive-amber"
                      : "border-hive-border text-hive-muted hover:text-hive-text"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-xs text-hive-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showTemplates}
              onChange={(e) => setShowTemplates(e.target.checked)}
            />
            <span>Show recurring templates</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20"
        >
          + task
        </button>
      </div>

      {!hydrated ? (
        <BoardSkeleton compact={compact} />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Your board is empty"
          description="Tasks let you queue work for an agent. Create one to start."
          cta={{ label: "+ New task", onClick: () => setNewOpen(true) }}
        />
      ) : null}

      {hydrated && tasks.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 ${
              compact ? "max-h-[520px] overflow-y-auto" : ""
            }`}
          >
            {TASK_STATUSES.map((status) => (
              <Column
                key={status}
                id={status}
                label={COLUMN_LABELS[status]}
                tasks={tasksByStatus[status]}
                projectsById={projectsById}
                onEdit={(t) => setEditTask(t)}
                onDelete={async (t) => {
                  const ok = await confirm({
                    title: "Delete task",
                    message: `Delete "${t.title}"? This cannot be undone.`,
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (!ok) return;
                  markLocal(t.id);
                  // Optimistic remove.
                  const prev = tasksRef.current;
                  setTasks(prev.filter((x) => x.id !== t.id));
                  try {
                    const res = await fetch(`/api/tasks/${t.id}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) {
                      const j = await res
                        .json()
                        .catch(() => ({ error: "Delete failed" }));
                      throw new Error(j.error ?? "Delete failed");
                    }
                    notify.success("Task deleted");
                  } catch (err) {
                    setTasks(prev);
                    notify.error(`Delete failed: ${(err as Error).message}`);
                  }
                }}
              />
            ))}
          </div>
        </DndContext>
      ) : null}

      <NewTaskModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          // SSE pushes the new task; nothing to do here.
        }}
        projects={projects}
        lockedProjectId={projectId}
      />

      <EditTaskModal
        open={editTask !== null}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={() => {
          // SSE pushes the update.
        }}
        onDeleted={() => {
          // SSE pushes the delete.
        }}
        projects={projects}
      />
    </div>
  );
}

function BoardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 ${
        compact ? "max-h-[520px] overflow-hidden" : ""
      }`}
    >
      {TASK_STATUSES.map((status) => (
        <div
          key={status}
          className="flex flex-col gap-2 border border-hive-border bg-hive-panel/40 p-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-hive-muted px-1 py-1">
            {COLUMN_LABELS[status]}
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ))}
    </div>
  );
}
