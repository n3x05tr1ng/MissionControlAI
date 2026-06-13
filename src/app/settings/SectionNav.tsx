"use client";

import type { ReactNode } from "react";

export type SectionDef = {
  id: string;
  label: string;
  icon: ReactNode;
};

type SectionNavProps = {
  sections: SectionDef[];
  activeId: string;
  /** ids de sección con cambios sin guardar (punto ámbar). */
  dirtyIds: Set<string>;
  onSelect: (id: string) => void;
  orientation?: "vertical" | "horizontal";
};

// Navegación de secciones con scroll-spy (el estado activo lo calcula el padre).
export function SectionNav({
  sections,
  activeId,
  dirtyIds,
  onSelect,
  orientation = "vertical",
}: SectionNavProps) {
  const vertical = orientation === "vertical";
  return (
    <nav aria-label="Settings sections">
      <ul
        className={
          vertical
            ? "flex flex-col gap-0.5"
            : "flex items-center gap-1 overflow-x-auto"
        }
      >
        {sections.map((s) => {
          const active = s.id === activeId;
          const dirty = dirtyIds.has(s.id);
          return (
            <li key={s.id} className={vertical ? undefined : "shrink-0"}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? "true" : undefined}
                className={`flex h-8 items-center gap-2.5 whitespace-nowrap rounded-sm px-2.5 text-[13px] ${
                  vertical ? "w-full" : ""
                } ${
                  active
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={active ? "text-primary" : "text-faint"}
                >
                  {s.icon}
                </span>
                <span className={vertical ? "flex-1 text-left" : ""}>
                  {s.label}
                </span>
                {dirty ? (
                  <span
                    title="Unsaved changes"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
