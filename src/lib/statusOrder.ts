import type { ProjectSnapshot, ProjectStatus } from "@/lib/contracts";

const STATUS_RANK: Partial<Record<ProjectStatus, number>> = {
  blocked: 0,
  "needs-input": 1,
  running: 2,
};

export function compareByStatus(
  a: ProjectSnapshot,
  b: ProjectSnapshot,
): number {
  const ra = STATUS_RANK[a.state.status];
  const rb = STATUS_RANK[b.state.status];

  if (ra !== undefined && rb !== undefined) {
    if (ra !== rb) return ra - rb;
    return a.config.name.localeCompare(b.config.name);
  }
  if (ra !== undefined) return -1;
  if (rb !== undefined) return 1;
  return a.config.name.localeCompare(b.config.name);
}
