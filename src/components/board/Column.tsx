"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { ProjectConfig, TaskRow, TaskStatus } from "@/lib/contracts";

import { TaskCard } from "./TaskCard";

type Props = {
  id: TaskStatus;
  label: string;
  tasks: TaskRow[];
  projectsById: Record<string, ProjectConfig>;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
};

export function Column({
  id,
  label,
  tasks,
  projectsById,
  onEdit,
  onDelete,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { status: id } });

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ {label} ]
        </h3>
        <span className="font-mono text-[10px] text-hive-muted">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[80px] border border-dashed p-2 flex flex-col gap-2 transition-colors ${
          isOver ? "border-hive-amber bg-hive-amber/5" : "border-hive-border bg-hive-panel/40"
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="text-xs italic text-hive-muted py-4 text-center">
              empty
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={projectsById[task.project_id]?.name}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
