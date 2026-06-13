"use client";

import { useState } from "react";

import { NewAutomationModal } from "@/components/automations/NewAutomationModal";

export function NewAutomationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        New automation
      </button>
      <NewAutomationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
