import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadProjectsConfig } from "@/lib/config";
import type {
  ProjectConfig,
  ProjectSnapshot,
  ProjectState,
} from "@/lib/contracts";
import { getGitInfo } from "@/lib/gitInfo";
import { readAndParseHandoff } from "@/lib/handoffParser";
import { upsertProjectIndex } from "@/lib/repos/projectIndex";

const VALID_STATUSES = new Set<string>([
  "idle",
  "running",
  "needs-input",
  "blocked",
  "done",
]);

export function readProjectState(
  projectPath: string,
  projectId: string,
): ProjectState {
  const filePath = join(projectPath, ".claude", "state.json");
  const fallback: ProjectState = {
    projectId,
    status: "idle",
    nextStep: "",
    blockers: [],
    openQuestions: [],
    lastSession: null,
    updatedAt: new Date().toISOString(),
  };

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }

  let parsed: Partial<ProjectState>;
  try {
    parsed = JSON.parse(raw) as Partial<ProjectState>;
  } catch {
    return fallback;
  }

  // JSON válido pero sin la forma mínima (p.ej. sin status) rompería el
  // upsert a sqlite con bindings undefined — cae al fallback.
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.status !== "string" ||
    !VALID_STATUSES.has(parsed.status)
  ) {
    return fallback;
  }

  return {
    projectId: parsed.projectId ?? fallback.projectId,
    status: parsed.status,
    nextStep: parsed.nextStep ?? fallback.nextStep,
    blockers: Array.isArray(parsed.blockers)
      ? parsed.blockers
      : fallback.blockers,
    openQuestions: Array.isArray(parsed.openQuestions)
      ? parsed.openQuestions
      : fallback.openQuestions,
    lastSession: parsed.lastSession ?? fallback.lastSession,
    updatedAt: parsed.updatedAt ?? fallback.updatedAt,
  };
}

export async function readProjectSnapshot(
  cfg: ProjectConfig,
): Promise<ProjectSnapshot> {
  const pathExists = existsSync(cfg.path);
  const [state, handoff, git] = await Promise.all([
    Promise.resolve(readProjectState(cfg.path, cfg.id)),
    Promise.resolve(readAndParseHandoff(cfg.path)),
    getGitInfo(cfg.path),
  ]);

  upsertProjectIndex({
    project_id: cfg.id,
    status: state.status ?? "idle",
    next_step: state.nextStep || null,
    last_session_at: state.lastSession?.endedAt ?? null,
    git_branch: git?.branch ?? null,
    git_dirty: git?.dirty ? 1 : 0,
    indexed_at: new Date().toISOString(),
  });

  return { config: cfg, state, handoff, git, pathExists };
}

export async function readAllSnapshots(): Promise<ProjectSnapshot[]> {
  const { projects } = loadProjectsConfig();
  return Promise.all(projects.map(readProjectSnapshot));
}
