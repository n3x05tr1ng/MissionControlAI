"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { ProjectConfig, TaskRow, TaskStatus } from "@/lib/contracts";

import { TaskCard } from "./TaskCard";

/* Color de estado por columna — solo tokens semánticos. */
const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-faint",
  ready: "bg-info",
  running: "bg-primary",
  review: "bg-warning",
  done: "bg-success",
};

type Props = {
  id: TaskStatus;
  label: string;
  tasks: TaskRow[];
  projectsById: Record<string, ProjectConfig>;
  /** Posición de la columna — escalona su entrada. */
  index?: number;
  compact?: boolean;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
};

/* Mini estado vacío ilustrado (SVG mono-línea, un detalle en --primary). */
function ColumnEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-8 text-center">
      <svg
        width="56"
        height="46"
        viewBox="0 0 56 46"
        fill="none"
        aria-hidden="true"
        className="text-faint"
      >
        <rect
          x="10"
          y="3"
          width="36"
          height="11"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <rect
          x="10"
          y="18"
          width="36"
          height="11"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          opacity="0.55"
        />
        <path
          d="M28 34v8M24 38h8"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-[11px] text-faint">No tasks — drop one here</p>
    </div>
  );
}

export function Column({
  id,
  label,
  tasks,
  projectsById,
  index = 0,
  compact,
  onEdit,
  onDelete,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { status: id } });
  // Delay de entrada congelado en el mount (no se reinicia en re-renders).
  const [enterDelay] = useState(() => Math.min(index, 7) * 40);

  return (
    <section
      aria-label={`${label}: ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      className={`animate-enter flex min-w-60 max-w-md flex-1 snap-start flex-col rounded-lg border bg-surface-1 shadow-bevel transition-colors ${
        isOver ? "border-primary/50" : "border-border"
      }`}
      style={{ animationDelay: `${enterDelay}ms` }}
    >
      <header className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${STATUS_DOT[id]} ${
            id === "running" ? "animate-pulse" : ""
          }`}
        />
        <h3 className="text-[12px] font-medium text-muted-foreground">{label}</h3>
        <span className="ml-auto rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-faint">
          {tasks.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded-b-lg p-2 transition-colors ${
          isOver ? "bg-primary-soft" : ""
        } ${compact ? "max-h-[420px] overflow-y-auto" : ""}`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <ColumnEmpty />
          ) : (
            tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                projectName={projectsById[task.project_id]?.name}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}
