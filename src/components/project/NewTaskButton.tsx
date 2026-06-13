"use client";

import { openModal } from "@/lib/ui/modalBus";

export function NewTaskButton() {
  return (
    <button
      type="button"
      onClick={() => openModal("newTask")}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M8 3.5v9M3.5 8h9" />
      </svg>
      New task
    </button>
  );
}
