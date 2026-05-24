import "server-only";

import type {
  AutomationEvent,
  ProjectConfig,
  ProjectIndexRow,
  TaskRow,
} from "@/lib/contracts";

type Subscriber<T> = (e: T) => void;

export class EventBus<T> {
  private subs = new Set<Subscriber<T>>();

  publish(e: T): void {
    for (const sub of this.subs) {
      try {
        sub(e);
      } catch (err) {
        process.stderr.write(
          `[realtime/bus] subscriber threw: ${(err as Error).message}\n`,
        );
      }
    }
  }

  subscribe(cb: Subscriber<T>): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
}

export type TaskEvent =
  | { type: "task.created"; task: TaskRow }
  | { type: "task.updated"; task: TaskRow }
  | { type: "task.deleted"; id: string };

export type ProjectEvent =
  | { type: "project.created"; project: ProjectConfig }
  | { type: "project.updated"; project: ProjectConfig }
  | { type: "project.deleted"; id: string }
  | { type: "project_index.updated"; row: ProjectIndexRow };

// Process-local singletons. In-memory pub/sub; not persisted.
export const taskBus = new EventBus<TaskEvent>();
export const projectBus = new EventBus<ProjectEvent>();
export const automationBus = new EventBus<AutomationEvent>();
