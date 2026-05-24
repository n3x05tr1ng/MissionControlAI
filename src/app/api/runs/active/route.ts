import "server-only";

import { apiError } from "@/lib/api/errors";
import { listActiveRuns } from "@/lib/engine/runner";
import { listProjects } from "@/lib/repos/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const runs = listActiveRuns();
    const projects = listProjects();
    const byId = new Map(projects.map((p) => [p.id, p.name]));
    const enriched = runs.map((r) => ({
      sessionId: r.sessionId,
      projectId: r.projectId,
      projectName: byId.get(r.projectId) ?? r.projectId,
      startedAt: r.startedAt,
      ageMs: r.ageMs,
    }));
    return Response.json(enriched);
  } catch (err) {
    return apiError((err as Error).message);
  }
}
