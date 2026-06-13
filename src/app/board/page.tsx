import { KanbanBoard } from "@/components/board/KanbanBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { TASK_STATUSES, type TaskStatus } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function parseStatus(value: string | string[] | undefined): TaskStatus | undefined {
  if (typeof value !== "string") return undefined;
  return (TASK_STATUSES as readonly string[]).includes(value)
    ? (value as TaskStatus)
    : undefined;
}

// Deep-link soportado: /board?status=review&projectId=… (NeedsAttention).
export default async function BoardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const projectId =
    typeof params.projectId === "string" && params.projectId.length > 0
      ? params.projectId
      : undefined;

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader
        overline="Board"
        title="Task Board"
        description="Queue, track and review agent work across every project."
      />
      <KanbanBoard
        // Remonta el board si cambian los filtros de la URL (mismo route).
        key={`${status ?? ""}:${projectId ?? ""}`}
        initialStatus={status}
        initialProjectId={projectId}
      />
    </section>
  );
}
