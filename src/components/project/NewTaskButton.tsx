"use client";

import { openModal } from "@/lib/ui/modalBus";

export function NewTaskButton() {
  return (
    <button
      type="button"
      onClick={() => openModal("newTask")}
      className="font-mono text-[11px] uppercase tracking-widest border border-hive-border px-2 py-1 text-hive-amber hover:border-hive-amber"
    >
      + New task
    </button>
  );
}
