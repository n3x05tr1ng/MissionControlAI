import "server-only";

import { readdirSync, readFileSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

import { load as yamlLoad } from "js-yaml";

import { notificationRow } from "@/lib/notify";
import { getProject } from "@/lib/repos/projects";
import { insertNotification } from "@/lib/repos/notifications";
import {
  getSettingRow,
  upsertSettingRow,
} from "@/lib/repos/settings";
import {
  insertTask,
  nextSortOrder,
  setRecurrence,
} from "@/lib/repos/tasks";

const WORKFLOWS_DIR = "workflows";
const FLAG_KEY = "workflows_imported";

interface RawAgentStep {
  id: string;
  agent: string;
  projectId: string;
  prompt: string;
}

interface RawWorkflow {
  name: string;
  description?: string;
  schedule?: string;
  steps: Array<Record<string, unknown>>;
}

function listYamlFiles(): string[] {
  const dir = join(process.cwd(), WORKFLOWS_DIR);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"))
    .filter((n) => !n.includes(".imported."))
    .filter((n) => !n.startsWith("_"))
    .filter((n) => !n.endsWith(".example.yaml") && !n.endsWith(".example.yml"))
    .map((n) => join(dir, n));
}

function parseWorkflow(text: string, filePath: string): RawWorkflow | null {
  try {
    const raw = yamlLoad(text);
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name : null;
    const steps = Array.isArray(obj.steps) ? obj.steps : null;
    if (!name || !steps) return null;
    return {
      name,
      description:
        typeof obj.description === "string" ? obj.description : undefined,
      schedule: typeof obj.schedule === "string" ? obj.schedule : undefined,
      steps: steps as Array<Record<string, unknown>>,
    };
  } catch (err) {
    process.stderr.write(
      `[import-once] failed to parse ${basename(filePath)}: ${(err as Error).message}\n`,
    );
    return null;
  }
}

function asAgentStep(step: Record<string, unknown>): RawAgentStep | null {
  const id = typeof step.id === "string" ? step.id : null;
  const agent = typeof step.agent === "string" ? step.agent : null;
  const projectId = typeof step.projectId === "string" ? step.projectId : null;
  const prompt = typeof step.prompt === "string" ? step.prompt : null;
  if (!id || !agent || !projectId || !prompt) return null;
  return { id, agent, projectId, prompt };
}

function renameImported(filePath: string): void {
  try {
    const dot = filePath.lastIndexOf(".");
    if (dot < 0) return;
    const base = filePath.slice(0, dot);
    const ext = filePath.slice(dot);
    const next = `${base}.imported${ext}`;
    renameSync(filePath, next);
  } catch (err) {
    process.stderr.write(
      `[import-once] rename failed for ${basename(filePath)}: ${(err as Error).message}\n`,
    );
  }
}

export function importWorkflowsOnce(): {
  imported: number;
  skipped: number;
  errors: number;
} {
  const counts = { imported: 0, skipped: 0, errors: 0 };
  const flag = getSettingRow(FLAG_KEY);
  if (flag?.value === "true") return counts;

  const files = listYamlFiles();
  if (files.length === 0) {
    upsertSettingRow(FLAG_KEY, "true");
    return counts;
  }

  for (const filePath of files) {
    let text: string;
    try {
      text = readFileSync(filePath, "utf8");
    } catch (err) {
      counts.errors += 1;
      process.stderr.write(
        `[import-once] read failed ${basename(filePath)}: ${(err as Error).message}\n`,
      );
      continue;
    }
    const wf = parseWorkflow(text, filePath);
    if (!wf) {
      counts.errors += 1;
      continue;
    }

    let importedAny = false;
    let skippedAny = false;
    for (const step of wf.steps) {
      const agentStep = asAgentStep(step);
      if (!agentStep) {
        skippedAny = true;
        counts.skipped += 1;
        continue;
      }
      if (!getProject(agentStep.projectId)) {
        counts.errors += 1;
        process.stderr.write(
          `[import-once] project not found '${agentStep.projectId}' in ${basename(filePath)} step ${agentStep.id}\n`,
        );
        continue;
      }
      const schedule = wf.schedule ?? null;
      const status = schedule ? "done" : "backlog";
      try {
        const row = insertTask({
          id: crypto.randomUUID(),
          project_id: agentStep.projectId,
          title: `${wf.name}: ${agentStep.id}`,
          description: wf.description ?? null,
          prompt: agentStep.prompt,
          agent_id: "claude-code",
          profile_id: "default",
          status,
          sort_order: nextSortOrder(status, agentStep.projectId),
          recurring_template: schedule ? 1 : 0,
        });
        if (schedule) {
          setRecurrence(row.id, schedule);
        }
        counts.imported += 1;
        importedAny = true;
      } catch (err) {
        counts.errors += 1;
        process.stderr.write(
          `[import-once] insertTask failed for ${wf.name}:${agentStep.id}: ${(err as Error).message}\n`,
        );
      }
    }

    if (skippedAny) {
      insertNotification(
        notificationRow({
          type: "nudge",
          title: `Workflow '${wf.name}' had non-agent steps`,
          body: `Some shell-only steps from ${basename(filePath)} were skipped during migration. Recreate them as tasks if you still need them.`,
          project_id: null,
        }),
      );
    }

    if (importedAny || skippedAny) {
      renameImported(filePath);
    }
  }

  upsertSettingRow(FLAG_KEY, "true");

  if (counts.imported > 0 || counts.skipped > 0) {
    insertNotification(
      notificationRow({
        type: "nudge",
        title: "Workflows migrated to Tasks",
        body: `Imported ${counts.imported} recurring task${counts.imported === 1 ? "" : "s"} from your old workflows/. The /workflows page is gone — find your recurring tasks on /board with the Recurring filter.`,
        project_id: null,
      }),
    );
  }

  return counts;
}
