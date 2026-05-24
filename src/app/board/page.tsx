import { KanbanBoard } from "@/components/board/KanbanBoard";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return (
    <section className="max-w-[1600px]">
      <header className="mb-6">
        <h1 className="font-mono text-xs tracking-widest text-hive-amber">
          [ BOARD ]
        </h1>
        <p className="mt-1 text-xs text-hive-muted">
          all projects, all agents
        </p>
      </header>
      <KanbanBoard />
    </section>
  );
}
