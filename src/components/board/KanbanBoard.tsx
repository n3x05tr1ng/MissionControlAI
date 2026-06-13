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
  backlog: "Backlog",
  ready: "Ready",
  running: "Running",
  review: "Review",
  done: "Done",
};

type Props = {
  /** Proyecto FIJADO (modo embebido en la página de proyecto). */
  projectId?: string;
  compact?: boolean;
  /** Deep-link (?status=…): muestra solo esa columna; filtro descartable. */
  initialStatus?: TaskStatus;
  /** Deep-link (?projectId=…): filtro de proyecto descartable (se ignora si projectId está fijado). */
  initialProjectId?: string;
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

function ClearIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FilterPill({
  label,
  clearLabel,
  onClear,
}: {
  label: string;
  clearLabel: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft py-0.5 pl-2.5 pr-1 font-mono text-[11px] text-primary">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="rounded-full p-0.5 hover:bg-primary/20"
      >
        <ClearIcon />
      </button>
    </span>
  );
}

export function KanbanBoard({
  projectId,
  compact,
  initialStatus,
  initialProjectId,
}: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recurrenceFilter, setRecurrenceFilter] = useState<
    "all" | "recurring" | "one-shot"
  >("all");
  // Filtros descartables que llegan por deep-link (?status / ?projectId).
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(
    initialStatus ?? null,
  );
  const [projectFilter, setProjectFilter] = useState<string | null>(
    projectId ? null : (initialProjectId ?? null),
  );

  const tasksRef = useRef<TaskRow[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const snaps = (await res.json()) as Array<{ config: ProjectConfig }>;
        if (!cancelled) setProjects(snaps.map((s) => s.config));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterForProject = useCallback(
    (incoming: TaskRow[]): TaskRow[] => {
      if (!projectId) return incoming;
      return incoming.filter((t) => t.project_id === projectId);
    },
    [projectId],
  );

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
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (!showTemplates && t.recurring_template === 1) return false;
      const isRecurring =
        t.recurring_template === 1 || t.schedule !== null;
      if (recurrenceFilter === "recurring" && !isRecurring) return false;
      if (recurrenceFilter === "one-shot" && isRecurring) return false;
      return true;
    });
  }, [tasks, showTemplates, recurrenceFilter, projectFilter]);

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

  const visibleStatuses: readonly TaskStatus[] = statusFilter
    ? [statusFilter]
    : TASK_STATUSES;

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

  // Mantiene la URL en sync al descartar filtros de deep-link (sin navegar).
  const syncFiltersToUrl = useCallback(
    (status: TaskStatus | null, project: string | null) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (status) url.searchParams.set("status", status);
      else url.searchParams.delete("status");
      if (project) url.searchParams.set("projectId", project);
      else url.searchParams.delete("projectId");
      window.history.replaceState(window.history.state, "", url.toString());
    },
    [],
  );

  function clearStatusFilter() {
    setStatusFilter(null);
    syncFiltersToUrl(null, projectFilter);
  }

  function clearProjectFilter() {
    setProjectFilter(null);
    syncFiltersToUrl(statusFilter, null);
  }

  function clearAllFilters() {
    setStatusFilter(null);
    setProjectFilter(null);
    setRecurrenceFilter("all");
    syncFiltersToUrl(null, null);
  }

  const hasDeepLinkFilters = statusFilter !== null || projectFilter !== null;

  const filterChips: Array<{
    id: "all" | "recurring" | "one-shot";
    label: string;
  }> = [
    { id: "all", label: "All" },
    { id: "recurring", label: "Recurring" },
    { id: "one-shot", label: "One-shot" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Recurrence filter"
            className="inline-flex items-center rounded-md border border-border bg-surface-1 p-0.5"
          >
            {filterChips.map((chip) => {
              const active = recurrenceFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRecurrenceFilter(chip.id)}
                  className={`rounded-sm px-2.5 py-1 text-[12px] font-medium ${
                    active
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={showTemplates}
              onChange={(e) => setShowTemplates(e.target.checked)}
            />
            <span>Show recurring templates</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
        >
          <PlusIcon />
          New task
        </button>
      </div>

      {hasDeepLinkFilters ? (
        <div className="animate-enter flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-faint">Filters:</span>
          {statusFilter ? (
            <FilterPill
              label={`status: ${COLUMN_LABELS[statusFilter]}`}
              clearLabel="Clear status filter"
              onClear={clearStatusFilter}
            />
          ) : null}
          {projectFilter ? (
            <FilterPill
              label={`project: ${projectsById[projectFilter]?.name ?? projectFilter}`}
              clearLabel="Clear project filter"
              onClear={clearProjectFilter}
            />
          ) : null}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11px] text-faint underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {!hydrated ? (
        <BoardSkeleton compact={compact} />
      ) : tasks.length === 0 ? (
        <EmptyState
          illustration="board"
          title="Your board is empty"
          description="Tasks queue work for an agent across your projects. Create your first one to get moving."
          cta={{ label: "New task", onClick: () => setNewOpen(true) }}
        />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          illustration="board"
          title="No tasks match these filters"
          description="Clear the active filters to see the rest of the board."
          cta={{ label: "Clear filters", onClick: clearAllFilters }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <div
            className={`flex snap-x gap-3 overflow-x-auto pb-2 ${
              compact ? "" : "min-h-[480px]"
            }`}
          >
            {visibleStatuses.map((status, i) => (
              <Column
                key={status}
                id={status}
                index={i}
                compact={compact}
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
      )}

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
    <div className={`flex gap-3 overflow-x-hidden ${compact ? "" : "min-h-[480px]"}`}>
      {TASK_STATUSES.map((status) => (
        <div
          key={status}
          className="flex min-w-60 max-w-md flex-1 flex-col gap-2 rounded-lg border border-border bg-surface-1 p-2 shadow-bevel"
        >
          <div className="flex items-center justify-between px-1 py-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-5" />
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
