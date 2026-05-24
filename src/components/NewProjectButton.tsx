"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { NewProjectModal } from "@/components/NewProjectModal";

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-hive-amber bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/10"
      >
        + New project
      </button>
      {open ? (
        <NewProjectModal
          onClose={() => setOpen(false)}
          onCreated={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
