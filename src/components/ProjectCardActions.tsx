"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ProjectForm } from "@/components/ProjectForm";
import { confirm } from "@/components/ui/ConfirmDialog";
import { notify } from "@/lib/ui/notify";
import type { ProjectConfig } from "@/lib/contracts";

type Props = {
  project: ProjectConfig;
};

export function ProjectCardActions({ project }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function stop(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  async function handleDelete(e: React.MouseEvent) {
    stop(e);
    setOpen(false);
    const confirmed = await confirm({
      title: "Delete project",
      message: `Delete '${project.name}'? Sessions stay but it disappears from the dashboard.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        notify.error(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      notify.success("Project deleted");
      router.refresh();
    } catch (err) {
      notify.error((err as Error).message);
      setBusy(false);
    }
  }

  async function submitEdit(values: {
    name: string;
    path: string;
    description: string;
    sandbox: boolean;
  }) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(project.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          path: values.path,
          description: values.description || null,
          sandbox: values.sandbox,
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="absolute right-2 top-2" onClick={stop}>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        disabled={busy}
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="animate-overlay absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-popover py-1 shadow-overlay"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              stop(e);
              setOpen(false);
              setEditing(true);
            }}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-surface-2"
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive-soft"
          >
            Delete
          </button>
        </div>
      ) : null}

      {editing ? (
        <ProjectForm
          title="Edit project"
          submitLabel="Save"
          enableBulk={false}
          initial={{
            name: project.name,
            path: project.path,
            description: project.description ?? "",
            sandbox: project.sandbox ?? false,
          }}
          onClose={() => setEditing(false)}
          onSubmit={submitEdit}
        />
      ) : null}
    </div>
  );
}
