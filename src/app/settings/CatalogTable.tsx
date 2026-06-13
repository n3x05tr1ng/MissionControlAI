"use client";

import { useState } from "react";

import { ChevronDownIcon, PlusIcon, TrashIcon } from "./icons";
import type { ModelEntry } from "./types";

type CatalogTableProps = {
  rows: ModelEntry[];
  onChange: (rows: ModelEntry[]) => void;
  error?: string | null;
};

const GRID_COLS =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_118px_40px] items-center gap-2";

const cellInputClass =
  "h-8 w-full rounded-sm border border-transparent bg-transparent px-2 font-mono text-[13px] text-foreground placeholder:text-faint transition-colors duration-[120ms] hover:border-input focus:border-primary/50 focus:bg-background/60";

// Tabla editable del catálogo de modelos. Serializa al mismo formato
// {id, label, kind}[] que espera POST /api/settings (key: models_catalog).
export function CatalogTable({ rows, onChange, error }: CatalogTableProps) {
  // Índice de la última fila añadida, para enfocar su input al montarse.
  const [justAdded, setJustAdded] = useState<number | null>(null);

  function patchRow(index: number, patch: Partial<ModelEntry>): void {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number): void {
    setJustAdded(null);
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow(): void {
    setJustAdded(rows.length);
    onChange([...rows, { id: "", label: "", kind: "engine" }]);
  }

  const engineCount = rows.filter((r) => r.kind === "engine").length;
  const assistantCount = rows.filter((r) => r.kind === "assistant").length;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background/40 ${
        error ? "border-destructive/40" : "border-border"
      }`}
    >
      <div
        className={`${GRID_COLS} border-b border-border bg-surface-2/50 px-3 py-2`}
        aria-hidden="true"
      >
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Model ID
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Label
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Kind
        </span>
        <span />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            The catalog is empty.
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-faint">
            Add at least one model so the engine and assistant dropdowns have
            options.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row, i) => (
            <li
              key={i}
              className={`${GRID_COLS} px-3 py-1.5 transition-colors duration-[120ms] hover:bg-surface-2/40`}
            >
              <input
                value={row.id}
                onChange={(e) => patchRow(i, { id: e.target.value })}
                placeholder="claude-sonnet-4-5"
                spellCheck={false}
                autoFocus={i === justAdded}
                aria-label={`Model ID, row ${i + 1}`}
                className={cellInputClass}
              />
              <input
                value={row.label}
                onChange={(e) => patchRow(i, { label: e.target.value })}
                placeholder="Sonnet 4.5"
                aria-label={`Label, row ${i + 1}`}
                className={cellInputClass}
              />
              <div className="relative">
                <select
                  value={row.kind}
                  onChange={(e) =>
                    patchRow(i, {
                      kind: e.target.value as ModelEntry["kind"],
                    })
                  }
                  aria-label={`Kind, row ${i + 1}`}
                  className="h-8 w-full appearance-none rounded-sm border border-transparent bg-transparent pl-2 pr-7 text-[13px] text-foreground transition-colors duration-[120ms] hover:border-input focus:border-primary/50"
                >
                  <option value="engine">engine</option>
                  <option value="assistant">assistant</option>
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
                >
                  <ChevronDownIcon size={13} />
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label={`Remove ${row.id || `row ${i + 1}`}`}
                className="flex h-8 w-8 items-center justify-center justify-self-end rounded-sm text-faint hover:bg-destructive-soft hover:text-destructive"
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-medium text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          <PlusIcon size={14} />
          Add model
        </button>
        <span className="font-mono text-[11px] text-faint">
          {engineCount} engine · {assistantCount} assistant
        </span>
      </div>
    </div>
  );
}
