import "server-only";

import { loadAppConfig, loadProjectsConfig } from "@/lib/config";
import type {
  LaunchFlags,
  ParsedHandoff,
  ProjectState,
  ReminderRow,
} from "@/lib/contracts";
import { startRun } from "@/lib/engine/runner";
import { readAndParseHandoff } from "@/lib/handoffParser";
import {
  readAllSnapshots,
  readProjectSnapshot,
} from "@/lib/projectReader";
import {
  insertReminder,
  listPendingReminders,
} from "@/lib/repos/reminders";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ToolHandler {
  def: ToolDef;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  nextStep: string;
  lastSessionAt: string | null;
  gitBranch: string | null;
  gitDirty: boolean;
}

const listProjectsTool: ToolHandler = {
  def: {
    name: "list_projects",
    description:
      "List every project in the user's portfolio with a lightweight summary: status, next step, last activity, and git branch. Call this first when reasoning about priorities or before you need a projectId.",
    input_schema: { type: "object", properties: {} },
  },
  async execute(): Promise<ProjectSummary[]> {
    const snapshots = await readAllSnapshots();
    return snapshots.map((s) => ({
      id: s.config.id,
      name: s.config.name,
      status: s.state.status,
      nextStep: s.state.nextStep,
      lastSessionAt: s.state.lastSession?.endedAt ?? null,
      gitBranch: s.git?.branch ?? null,
      gitDirty: Boolean(s.git?.dirty),
    }));
  },
};

const getProjectStateTool: ToolHandler = {
  def: {
    name: "get_project_state",
    description:
      "Fetch the full ProjectState (status, nextStep, blockers, openQuestions, lastSession) for a single project. Use after list_projects when you need detail to advise on a project.",
    input_schema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "ID of the project as returned by list_projects.",
        },
      },
      required: ["projectId"],
    },
  },
  async execute(input): Promise<ProjectState | { error: string }> {
    const projectId = asString(input.projectId);
    if (!projectId) return { error: "projectId is required" };
    const { projects } = loadProjectsConfig();
    const cfg = projects.find((p) => p.id === projectId);
    if (!cfg) return { error: `Project not found: ${projectId}` };
    const snapshot = await readProjectSnapshot(cfg);
    return snapshot.state;
  },
};

const getHandoffTool: ToolHandler = {
  def: {
    name: "get_handoff",
    description:
      "Read and parse the .claude/handoff.md for a project. Returns sections (doneThisSession, nextStep, blockers, openQuestions, filesTouched, contextForNextRun) or null if there is no handoff yet.",
    input_schema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "ID of the project as returned by list_projects.",
        },
      },
      required: ["projectId"],
    },
  },
  async execute(input): Promise<ParsedHandoff | null | { error: string }> {
    const projectId = asString(input.projectId);
    if (!projectId) return { error: "projectId is required" };
    const { projects } = loadProjectsConfig();
    const cfg = projects.find((p) => p.id === projectId);
    if (!cfg) return { error: `Project not found: ${projectId}` };
    return readAndParseHandoff(cfg.path);
  },
};

const listRemindersTool: ToolHandler = {
  def: {
    name: "list_reminders",
    description:
      "List all pending reminders across the portfolio, ordered by due date. Use to surface follow-ups the user already asked you to track.",
    input_schema: { type: "object", properties: {} },
  },
  async execute(): Promise<ReminderRow[]> {
    return listPendingReminders();
  },
};

const createReminderTool: ToolHandler = {
  def: {
    name: "create_reminder",
    description:
      "Schedule a reminder for a future moment. Use when the user asks you to remember something, or proactively when a project is blocked and you want to nudge later. dueAt must be an ISO-8601 timestamp.",
    input_schema: {
      type: "object",
      properties: {
        projectId: {
          type: ["string", "null"],
          description: "Optional project id this reminder is tied to.",
        },
        message: {
          type: "string",
          description: "Human-readable reminder text.",
        },
        dueAt: {
          type: "string",
          description: "ISO-8601 timestamp for when the reminder is due.",
        },
      },
      required: ["message", "dueAt"],
    },
  },
  async execute(input): Promise<ReminderRow | { error: string }> {
    const message = asString(input.message);
    const dueAt = asString(input.dueAt);
    if (!message) return { error: "message is required" };
    if (!dueAt) return { error: "dueAt is required" };

    // El scheduler compara due_at lexicográficamente contra ISO UTC, así que
    // normalizamos cualquier offset (p. ej. -04:00) a UTC antes de guardar.
    const dueAtMs = Date.parse(dueAt);
    if (Number.isNaN(dueAtMs)) {
      return {
        error: `dueAt must be a valid ISO-8601 timestamp, got: ${dueAt}`,
      };
    }

    const rawProjectId = input.projectId;
    const projectId =
      typeof rawProjectId === "string" && rawProjectId.length > 0
        ? rawProjectId
        : null;

    if (projectId) {
      const { projects } = loadProjectsConfig();
      if (!projects.find((p) => p.id === projectId)) {
        return { error: `Project not found: ${projectId}` };
      }
    }

    const row: ReminderRow = {
      id: crypto.randomUUID(),
      project_id: projectId,
      message,
      due_at: new Date(dueAtMs).toISOString(),
      kind: "manual",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    insertReminder(row);
    return row;
  },
};

const triggerRunTool: ToolHandler = {
  def: {
    name: "trigger_run",
    description:
      "Kick off an Engine run on a project with the given prompt. Returns the runId; the actual session streams independently on the project's page. Use sparingly — only when the user explicitly asks, or a project is clearly blocked on a quick concrete action.",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        prompt: {
          type: "string",
          description: "Full prompt for the Engine session.",
        },
        planMode: {
          type: "boolean",
          description: "If true, runs in plan-only mode (no writes).",
        },
        model: {
          type: "string",
          description:
            "Optional model id; defaults to app.config.json defaultEngineModel.",
        },
      },
      required: ["projectId", "prompt"],
    },
  },
  async execute(input): Promise<{ runId: string; sessionId: string } | { error: string }> {
    const projectId = asString(input.projectId);
    const prompt = asString(input.prompt);
    if (!projectId) return { error: "projectId is required" };
    if (!prompt) return { error: "prompt is required" };

    const { projects } = loadProjectsConfig();
    if (!projects.find((p) => p.id === projectId)) {
      return { error: `Project not found: ${projectId}` };
    }

    const appConfig = loadAppConfig();
    const planMode = asBoolean(input.planMode) ?? false;
    const model = asString(input.model) ?? appConfig.defaultEngineModel;

    const flags: LaunchFlags = {
      rawPrompt: prompt,
      finalPrompt: prompt,
      planMode,
      useSubagents: false,
      model,
      allowedTools: [],
    };

    const { sessionId } = await startRun(projectId, flags);
    return { runId: sessionId, sessionId };
  },
};

const HANDLERS: ToolHandler[] = [
  listProjectsTool,
  getProjectStateTool,
  getHandoffTool,
  listRemindersTool,
  createReminderTool,
  triggerRunTool,
];

const HANDLER_BY_NAME = new Map(HANDLERS.map((h) => [h.def.name, h]));

export const toolDefinitions: ToolDef[] = HANDLERS.map((h) => h.def);

export async function executeTool(
  name: string,
  input: unknown,
): Promise<unknown> {
  const handler = HANDLER_BY_NAME.get(name);
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }
  const safeInput =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  try {
    return await handler.execute(safeInput);
  } catch (err) {
    return { error: (err as Error).message };
  }
}
