import "server-only";

import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

import type { ProjectConfig, ProjectsConfigFile } from "@/lib/contracts";
import { notificationRow } from "@/lib/notify";
import { insertNotification } from "@/lib/repos/notifications";
import {
  countProjects,
  insertProject,
  listProjects,
} from "@/lib/repos/projects";
import { getSettingRow, upsertSettingRow } from "@/lib/repos/settings";

// Backwards-compatibility shim: the legacy JSON-backed loader has been
// replaced by the SQLite settings-backed builder in `@/lib/appConfig`.
// Every existing caller imports `loadAppConfig` from here, so we keep
// the name stable via a re-export.
export { getAppConfig as loadAppConfig } from "@/lib/appConfig";

const IMPORT_FLAG_KEY = "projects_imported_from_json";

let importChecked = false;

function importLegacyJsonIfNeeded(): void {
  if (importChecked) return;
  importChecked = true;

  if (getSettingRow(IMPORT_FLAG_KEY) !== null) return;

  const filePath = join(process.cwd(), "projects.config.json");
  let raw: string | null = null;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      process.stderr.write(
        `[config] failed reading projects.config.json: ${(err as Error).message}\n`,
      );
    }
  }

  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const arr = Array.isArray(parsed.projects)
        ? (parsed.projects as ProjectConfig[])
        : [];

      if (arr.length > 0 && countProjects() === 0) {
        for (const p of arr) {
          if (!p?.id || !p?.name || !p?.path) continue;
          insertProject({
            id: p.id,
            name: p.name,
            path: p.path,
            description: p.description,
            sandbox: p.sandbox ? 1 : 0,
          });
        }

        try {
          renameSync(filePath, `${filePath}.imported`);
        } catch (err) {
          process.stderr.write(
            `[config] failed renaming projects.config.json: ${(err as Error).message}\n`,
          );
        }

        insertNotification(
          notificationRow({
            type: "nudge",
            title: "Projects migrated to DB",
            body: `Imported ${arr.length} projects from projects.config.json. You can now add/edit/delete projects from the dashboard.`,
          }),
        );
      }
    } catch (err) {
      process.stderr.write(
        `[config] invalid JSON in projects.config.json: ${(err as Error).message}\n`,
      );
    }
  }

  upsertSettingRow(IMPORT_FLAG_KEY, "true");
}

export function loadProjectsConfig(): ProjectsConfigFile {
  importLegacyJsonIfNeeded();
  return { projects: listProjects() };
}

export function addProject(p: ProjectConfig): void {
  insertProject({
    id: p.id,
    name: p.name,
    path: p.path,
    description: p.description,
    sandbox: p.sandbox ? 1 : 0,
  });
}

