"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { TaskRow } from "@/lib/contracts";
import { CRON_PRESETS, describeCron } from "@/lib/tasks/cronPresets";

function RecurringIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function recurrenceLabel(task: TaskRow): string {
  const cron = task.schedule;
  if (!cron) return "scheduled";
  const preset = CRON_PRESETS.find((p) => p.cron === cron);
  return preset ? preset.label : describeCron(cron);
}

type Props = {
  task: TaskRow;
  projectName?: string;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
};

function StatusBadge({ task }: { task: TaskRow }) {
  if (task.status === "running") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
        ● live
      </span>
    );
  }
  if (task.status === "review") {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-widest text-emerald-400"
        title="awaiting review"
      >
        ✓ ok
      </span>
    );
  }
  if (task.status === "done") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-hive-muted">
        ✓ done
      </span>
    );
  }
  if (task.status === "backlog" && task.last_error) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-widest text-red-400"
        title={task.last_error}
      >
        ● err
      </span>
    );
  }
  return null;
}

export function TaskCard({ task, projectName, onEdit, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative border border-hive-border bg-hive-bg/60 p-3 hover:border-hive-amber/60 hover:bg-hive-bg/80 transition-colors duration-150 ease-out cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-hive-text leading-snug break-words min-w-0">
          {task.title}
        </h3>
        <StatusBadge task={task} />
      </div>

      {task.description ? (
        <p className="mt-1 text-xs text-hive-muted line-clamp-1">
          {task.description}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest border border-hive-border px-1.5 py-0.5 text-hive-muted">
          {task.agent_id}
        </span>
        {projectName ? (
          <span className="font-mono text-[10px] uppercase tracking-widest border border-hive-border px-1.5 py-0.5 text-hive-muted">
            {projectName}
          </span>
        ) : null}
        {task.recurring_template === 1 || task.schedule !== null ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-hive-amber/50 px-1.5 py-0.5 text-hive-amber"
            title={task.schedule ?? "scheduled"}
          >
            <RecurringIcon />
            {recurrenceLabel(task)}
          </span>
        ) : null}
        {task.parent_template_id ? (
          <span
            className="font-mono text-[10px] uppercase tracking-widest border border-hive-border px-1.5 py-0.5 text-hive-muted"
            title={`Spawned from template ${task.parent_template_id}`}
          >
            from template
          </span>
        ) : null}
      </div>

      {(onEdit || onDelete) && (
        <details
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <summary className="list-none cursor-pointer text-hive-muted hover:text-hive-amber px-1 select-none text-xs">
            ⋯
          </summary>
          <div className="absolute right-0 mt-1 z-10 border border-hive-border bg-hive-panel py-1 min-w-[100px] shadow-lg">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="block w-full text-left px-3 py-1 text-xs text-hive-text hover:bg-hive-bg/60"
              >
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(task)}
                className="block w-full text-left px-3 py-1 text-xs text-red-400 hover:bg-hive-bg/60"
              >
                Delete
              </button>
            ) : null}
          </div>
        </details>
      )}
    </div>
  );
}
