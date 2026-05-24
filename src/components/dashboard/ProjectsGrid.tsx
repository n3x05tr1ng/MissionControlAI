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
      <header className="mb-2 px-1">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-hive-amber">
          [ PROJECTS · {snapshots.length} ]
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
