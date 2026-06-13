"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

import { ChevronDownIcon } from "./icons";

/* ------------------------------ class recipes ----------------------------- */

// Input base — sin ancho: añade w-full/w-24 donde se use.
export const inputClass =
  "h-9 rounded-md border border-input bg-background/60 px-3 text-sm text-foreground placeholder:text-faint transition-colors duration-[120ms] focus:border-primary/50";

export const primaryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow disabled:pointer-events-none disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/* -------------------------------- components ------------------------------ */

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Select del sistema: nativo + chevron propio (appearance-none).
export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...rest}
        className="h-9 w-full appearance-none rounded-md border border-input bg-background/60 pl-3 pr-9 text-sm text-foreground transition-colors duration-[120ms] focus:border-primary/50"
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      >
        <ChevronDownIcon size={14} />
      </span>
    </div>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};

// Toggle accesible (role=switch); anima solo transform/color.
export function Switch({ checked, onChange, ariaLabel, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-9 shrink-0 rounded-full border ${
        checked
          ? "border-transparent bg-primary"
          : "border-border-strong bg-surface-3"
      } disabled:pointer-events-none disabled:opacity-50`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-[3px] top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full transition-transform duration-[120ms] ${
          checked
            ? "translate-x-[14px] bg-primary-foreground"
            : "translate-x-0 bg-foreground/80"
        }`}
      />
    </button>
  );
}

type StatusPillProps = {
  tone: "success" | "warning" | "destructive";
  children: ReactNode;
};

const PILL_TONE: Record<StatusPillProps["tone"], string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
};

const PILL_DOT: Record<StatusPillProps["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium ${PILL_TONE[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${PILL_DOT[tone]}`}
      />
      {children}
    </span>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-foreground"
      >
        {label}
      </label>
      {hint ? (
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type SectionCardProps = {
  id: string;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
};

// Card de sección con ancla para el scroll-spy (scroll-mt compensa la nav móvil).
export function SectionCard({
  id,
  title,
  description,
  badge,
  children,
}: SectionCardProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="hive-card scroll-mt-16 p-5 lg:scroll-mt-6"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="text-[15px] font-semibold text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </header>
      {children}
    </section>
  );
}
