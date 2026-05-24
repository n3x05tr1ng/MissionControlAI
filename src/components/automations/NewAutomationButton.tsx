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
        className="border border-hive-amber bg-hive-amber/10 px-3 py-1 text-xs uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20"
      >
        + New automation
      </button>
      <NewAutomationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
