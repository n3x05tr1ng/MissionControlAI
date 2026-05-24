import "server-only";

import { taskBus, type TaskEvent } from "@/lib/realtime/bus";
import { listTasks } from "@/lib/repos/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

type SnapshotFrame = { type: "snapshot"; tasks: ReturnType<typeof listTasks> };
type WireFrame = SnapshotFrame | TaskEvent;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (frame: WireFrame): void => {
        safeEnqueue(`data: ${JSON.stringify(frame)}\n\n`);
      };

      // Initial snapshot — client renders immediately, no separate fetch.
      send({ type: "snapshot", tasks: listTasks() });

      const unsubscribe = taskBus.subscribe((e) => send(e));

      const keepalive = setInterval(() => {
        safeEnqueue(`: ping\n\n`);
      }, KEEPALIVE_MS);

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      // Consumer disconnected; start() cleanup runs via the abort listener.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
