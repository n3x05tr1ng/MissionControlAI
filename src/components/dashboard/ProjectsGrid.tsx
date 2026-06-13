import "server-only";

import { ProjectCard } from "@/components/ProjectCard";
import type { ProjectSnapshot } from "@/lib/contracts";
import type { ProjectTaskCounts } from "@/lib/repos/tasks";

type Props = {
  snapshots: ProjectSnapshot[];
  tasksByProject: Record<string, ProjectTaskCounts>;
};

export function ProjectsGrid({ snapshots, tasksByProject }: Props) {
  return (
    <section>
      <header className="mb-2 flex items-center gap-2 px-1">
        <h2 className="text-sm font-medium text-foreground">Projects</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {snapshots.length}
        </span>
      </header>
      <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2">
        {snapshots.map((s) => (
          <ProjectCard
            key={s.config.id}
            snapshot={s}
            taskCounts={
              tasksByProject[s.config.id] ?? { open: 0, running: 0 }
            }
          />
        ))}
      </div>
    </section>
  );
}
