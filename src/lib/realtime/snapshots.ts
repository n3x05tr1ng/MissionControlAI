import "server-only";

import type { ProjectConfig, ProjectIndexRow } from "@/lib/contracts";
import { listProjectIndex } from "@/lib/repos/projectIndex";
import { listProjects } from "@/lib/repos/projects";

export interface ProjectsStreamSnapshot {
  projects: ProjectConfig[];
  index: ProjectIndexRow[];
}

export function getProjectsSnapshotForStream(): ProjectsStreamSnapshot {
  return {
    projects: listProjects(),
    index: listProjectIndex(),
  };
}
