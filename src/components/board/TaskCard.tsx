"use client";

import { useEffect, useRef, useState } from "react";
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

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function recurrenceLabel(task: TaskRow): string {
  const cron = task.schedule;
  if (!cron) return "scheduled";
  const preset = CRON_PRESETS.find((p) => p.cron === cron);
  return preset ? preset.label : describeCron(cron);
}

/* Estado de la tarjeta con tokens semánticos (patrón badge: *-soft + color vivo). */
function TaskStateBadge({ task }: { task: TaskRow }) {
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px]";
  if (task.status === "running") {
    return (
      <span className={`${base} bg-primary-soft text-primary`} title="Agent running">
        <span aria-hidden="true" className="size-1 animate-pulse rounded-full bg-current" />
        live
      </span>
    );
  }
  if (task.status === "review") {
    return (
      <span className={`${base} bg-warning-soft text-warning`} title="Awaiting your review">
        <span aria-hidden="true" className="size-1 rounded-full bg-current" />
        review
      </span>
    );
  }
  if (task.status === "done") {
    return (
      <span className={`${base} bg-success-soft text-success`} title="Completed">
        <span aria-hidden="true" className="size-1 rounded-full bg-current" />
        done
      </span>
    );
  }
  if (task.status === "backlog" && task.last_error) {
    return (
      <span className={`${base} bg-destructive-soft text-destructive`} title={task.last_error}>
        <span aria-hidden="true" className="size-1 rounded-full bg-current" />
        error
      </span>
    );
  }
  return null;
}

type Props = {
  task: TaskRow;
  projectName?: string;
  /** Posición dentro de la columna — escalona la entrada (cap 8). */
  index?: number;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
};

// Caída suave al soltar (ease-out corto, design language §5).
const DROP_TRANSITION = {
  duration: 200,
  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
};

const metaChipCls =
  "rounded-xs border border-border px-1.5 py-0.5 font-mono text-[10px] text-faint";

export function TaskCard({ task, projectName, index = 0, onEdit, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task }, transition: DROP_TRANSITION });

  const [menuOpen, setMenuOpen] = useState(false);
  // Delay de entrada congelado en el mount (no se reinicia al reordenar).
  const [enterDelay] = useState(() => Math.min(index, 7) * 30);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Cierra el menú con click fuera o Escape (devolviendo el foco al trigger).
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Al abrir, mueve el foco al primer item del menú.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
  }, [menuOpen]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  }

  // El nodo externo lleva el transform de dnd-kit; el interno la animación de
  // entrada (no pueden convivir en el mismo elemento: la animation pisa el
  // transform inline mientras corre).
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hasMenu = Boolean(onEdit || onDelete);
  const isRecurring = task.recurring_template === 1 || task.schedule !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div
        className="group animate-enter relative rounded-md border border-border bg-surface-2 p-3 shadow-bevel hover:border-border-strong hover:bg-surface-3"
        style={{ animationDelay: `${enterDelay}ms` }}
      >
        <div className={`flex items-start justify-between gap-2 ${hasMenu ? "pr-5" : ""}`}>
          <h4 className="min-w-0 break-words text-[13px] font-medium leading-snug text-foreground">
            {task.title}
          </h4>
          <TaskStateBadge task={task} />
        </div>

        {task.description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className={metaChipCls}>{task.agent_id}</span>
          {projectName ? <span className={metaChipCls}>{projectName}</span> : null}
          {isRecurring ? (
            <span
              className="inline-flex items-center gap-1 rounded-xs border border-primary/40 bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary"
              title={task.schedule ?? "scheduled"}
            >
              <RecurringIcon />
              {recurrenceLabel(task)}
            </span>
          ) : null}
          {task.parent_template_id ? (
            <span
              className={metaChipCls}
              title={`Spawned from template ${task.parent_template_id}`}
            >
              from template
            </span>
          ) : null}
        </div>

        {hasMenu ? (
          <>
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Actions for "${task.title}"`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`absolute right-1.5 top-1.5 rounded-sm p-1 text-faint transition-opacity hover:bg-surface-3 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 ${
                menuOpen ? "text-foreground opacity-100" : "opacity-0"
              }`}
            >
              <DotsIcon />
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for "${task.title}"`}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={onMenuKeyDown}
                className="animate-overlay absolute right-1.5 top-8 z-20 min-w-[132px] rounded-md border border-border bg-popover py-1 shadow-overlay"
              >
                {onEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit(task);
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-surface-2"
                  >
                    Edit task
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(task);
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-destructive hover:bg-destructive-soft"
                  >
                    Delete task
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
