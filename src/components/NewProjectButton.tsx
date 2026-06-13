"use client";

import { openModal } from "@/lib/ui/modalBus";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

// Opens the global "new project" modal (mounted once by GlobalModalsHost,
// which also refreshes the router after creation).
export function NewProjectButton() {
  return (
    <button
      type="button"
      onClick={() => openModal("newProject")}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
    >
      <PlusIcon />
      New project
    </button>
  );
}
