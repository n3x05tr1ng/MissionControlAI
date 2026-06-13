"use client";

import { useEffect, type ReactNode } from "react";

/* Recetas de formulario/botón compartidas por los modales del board
   (ver DESIGN_NOTES.md §3 — recetas de botón). */
export const fieldLabelCls = "text-[12px] font-medium text-muted-foreground";
export const inputCls =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint";
export const selectCls =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground";
export const textareaCls =
  "rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-faint";
export const btnPrimaryCls =
  "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:pointer-events-none disabled:opacity-50";
export const btnSecondaryCls =
  "inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground";
export const btnDangerCls =
  "inline-flex h-9 items-center justify-center rounded-md border border-destructive/40 bg-destructive-soft px-3 text-[13px] font-medium text-destructive hover:bg-destructive/25 disabled:pointer-events-none disabled:opacity-50";

function CloseIcon() {
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
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Cáscara de modal estándar del board: backdrop + panel glass + Escape. */
export function TaskModalShell({ title, onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="hive-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass animate-overlay flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-sm p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
