"use client";

import { ProjectForm } from "@/components/ProjectForm";
import { notify } from "@/lib/ui/notify";
import type { ProjectConfig } from "@/lib/contracts";

type Props = {
  onClose: () => void;
  onCreated: (project: ProjectConfig) => void;
};

export function NewProjectModal({ onClose, onCreated }: Props) {
  async function submit(values: {
    name: string;
    path: string;
    description: string;
    sandbox: boolean;
  }) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        path: values.path,
        description: values.description || undefined,
        sandbox: values.sandbox,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const created = (await res.json()) as ProjectConfig;
    notify.success(`Project "${created.name}" created`);
    onCreated(created);
  }

  return (
    <ProjectForm
      title="NEW PROJECT"
      submitLabel="Create"
      onClose={onClose}
      onSubmit={submit}
    />
  );
}
