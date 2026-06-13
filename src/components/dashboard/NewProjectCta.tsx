"use client";

import { openModal } from "@/lib/ui/modalBus";

// Primary CTA of the dashboard header. Opens the global "new project" modal
// hosted by GlobalModalsHost via the modal bus.
export function NewProjectCta() {
  return (
    <button
      type="button"
      onClick={() => openModal("newProject")}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      New project
    </button>
  );
}
