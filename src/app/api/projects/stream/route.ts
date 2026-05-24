import "server-only";

import { projectBus, type ProjectEvent } from "@/lib/realtime/bus";
import {
  getProjectsSnapshotForStream,
  type ProjectsStreamSnapshot,
} from "@/lib/realtime/snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

type SnapshotFrame = { type: "snapshot" } & ProjectsStreamSnapshot;
type WireFrame = SnapshotFrame | ProjectEvent;

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

      const snap = getProjectsSnapshotForStream();
      send({ type: "snapshot", ...snap });

      const unsubscribe = projectBus.subscribe((e) => send(e));

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
