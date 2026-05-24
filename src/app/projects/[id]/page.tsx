import Link from "next/link";

import { NewTaskButton } from "@/components/project/NewTaskButton";
import { ProjectSplit } from "@/components/project/ProjectSplit";
import { ProjectActivity } from "@/components/stats/ProjectActivity";
import { StatusBadge } from "@/components/StatusBadge";
import { loadAppConfig, loadProjectsConfig } from "@/lib/config";
import { readProjectSnapshot } from "@/lib/projectReader";
import { notificationsForProject } from "@/lib/repos/notifications";
import { listRemindersForProject } from "@/lib/repos/reminders";
import { listSessionsForProject } from "@/lib/repos/sessions";
import { formatRelative } from "@/lib/time";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const { projects } = loadProjectsConfig();
  const cfg = projects.find((p) => p.id === id);

  if (!cfg) {
    return (
      <section className="max-w-3xl">
        <header className="mb-4">
          <h1 className="font-mono text-xs tracking-widest text-hive-amber">
            [ PROJECT NOT FOUND ]
          </h1>
        </header>
        <div className="border border-hive-border bg-hive-panel p-6">
          <p className="text-sm text-hive-text">
            No project with id <code className="font-mono text-hive-amber">{id}</code>.
          </p>
          <p className="mt-2 text-sm text-hive-muted">
            Check{" "}
            <code className="font-mono text-hive-amber">projects.config.json</code>{" "}
            or go back to the{" "}
            <Link href="/" className="text-hive-amber hover:underline">
              dashboard
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  const [snapshot, sessions, reminders, notifications] = await Promise.all([
    readProjectSnapshot(cfg),
    Promise.resolve(listSessionsForProject(id, 20)),
    Promise.resolve(listRemindersForProject(id)),
    Promise.resolve(notificationsForProject(id, 20)),
  ]);

  const { state, git } = snapshot;
  const appConfig = loadAppConfig();
  const engineModels = appConfig.models.filter((m) => m.kind === "engine");
  const lastRunAt = state.lastSession?.endedAt ?? null;

  return (
    <section className="max-w-7xl">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
          >
            ← back
          </Link>
          <h1 className="text-xl font-semibold text-hive-text">{cfg.name}</h1>
          <StatusBadge status={state.status} />
          {git?.branch ? (
            <code className="font-mono text-[11px] text-hive-muted">
              {git.branch}
              {git.dirty ? "*" : ""}
            </code>
          ) : null}
          {lastRunAt ? (
            <span className="font-mono text-[11px] text-hive-muted">
              ran {formatRelative(lastRunAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <NewTaskButton />
        </div>
      </header>

      <ProjectSplit
        projectId={cfg.id}
        snapshot={snapshot}
        sessions={sessions}
        reminders={reminders}
        notifications={notifications}
        engineModels={engineModels}
        defaultEngineModel={appConfig.defaultEngineModel}
        activitySlot={<ProjectActivity projectId={cfg.id} />}
      />
    </section>
  );
}
