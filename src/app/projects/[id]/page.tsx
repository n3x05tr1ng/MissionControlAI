import { EmptyState } from "@/components/EmptyState";
import { NewTaskButton } from "@/components/project/NewTaskButton";
import { ProjectSplit } from "@/components/project/ProjectSplit";
import { ProjectActivity } from "@/components/stats/ProjectActivity";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
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

function BranchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 text-muted-foreground"
      aria-hidden="true"
    >
      <circle cx="4.5" cy="3.5" r="1.8" />
      <circle cx="4.5" cy="12.5" r="1.8" />
      <circle cx="11.5" cy="5" r="1.8" />
      <path d="M4.5 5.3v5.4M11.5 6.8c0 2.6-3 3.2-5 3.6" />
    </svg>
  );
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const { projects } = loadProjectsConfig();
  const cfg = projects.find((p) => p.id === id);

  if (!cfg) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center">
        <div className="w-full">
          <EmptyState
            illustration="folder"
            title="Project not found"
            description="We couldn't find this project — it may have been removed, or the link is out of date."
            cta={{ label: "Back to dashboard", href: "/" }}
            secondary={{ label: "Open settings", href: "/settings" }}
          />
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
    <section className="mx-auto flex max-w-7xl flex-col">
      <PageHeader
        overline="Project"
        title={cfg.name}
        description={
          lastRunAt ? `Last run ${formatRelative(lastRunAt)}` : "No runs yet"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={state.status} />
            {git?.branch ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                <BranchIcon />
                {git.branch}
                {git.dirty ? (
                  <span className="text-warning" title="Uncommitted changes">
                    *
                  </span>
                ) : null}
              </span>
            ) : null}
            <NewTaskButton />
          </div>
        }
      />

      {!snapshot.pathExists ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
        >
          <p className="font-medium">
            Project folder not found:{" "}
            <code className="font-mono text-[12px]">{cfg.path}</code>
          </p>
          <p className="mt-1 text-muted-foreground">
            The folder was moved, renamed or deleted, so the terminal, git
            panel and runs can&apos;t start. Fix the path from the dashboard:
            open the <span className="font-medium">⋯ menu</span> on this
            project&apos;s card and choose{" "}
            <span className="font-medium">Edit</span>.
          </p>
        </div>
      ) : null}
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
