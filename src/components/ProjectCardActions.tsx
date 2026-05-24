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
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
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
        className="border border-transparent bg-transparent px-2 py-0.5 font-mono text-sm leading-none text-hive-muted hover:text-hive-amber hover:border-hive-border disabled:opacity-50"
      >
        {"…"}
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-10 mt-1 min-w-[120px] border border-hive-border bg-hive-panel py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setOpen(false);
              setEditing(true);
            }}
            className="block w-full px-3 py-1 text-left font-mono text-xs text-hive-text hover:bg-hive-amber/10 hover:text-hive-amber"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="block w-full px-3 py-1 text-left font-mono text-xs text-red-400 hover:bg-red-400/10"
          >
            Delete
          </button>
        </div>
      ) : null}

      {editing ? (
        <ProjectForm
          title="EDIT PROJECT"
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
