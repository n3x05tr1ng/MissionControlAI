import { EmptyState } from "@/components/EmptyState";

// Server-safe: the CTA uses the serializable `modal` form of EmptyState,
// which opens the global "new project" modal via modalBus.
export function NewProjectEmptyState() {
  return (
    <EmptyState
      illustration="hex"
      title="No projects yet"
      description="Connect a local repository and Hive will keep its agents, tasks, and runs in one place."
      cta={{ label: "New project", modal: "newProject" }}
    />
  );
}
