"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { HexIcon } from "@/components/icons/HexIcon";
import { NewProjectModal } from "@/components/NewProjectModal";

export function NewProjectEmptyState() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <EmptyState
        icon={<HexIcon size={48} strokeWidth={1.25} />}
        title="No projects yet"
        description="Add your first project to start managing your work from one place."
        cta={{ label: "+ New project", onClick: () => setOpen(true) }}
      />
      {open ? (
        <NewProjectModal
          onClose={() => setOpen(false)}
          onCreated={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
