import "server-only";

import type { AutomationEvent } from "@/lib/contracts";
import { automationBus } from "@/lib/realtime/bus";
import { listRecentRuns } from "@/lib/repos/automationRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

type SnapshotFrame = {
  type: "snapshot";
  runs: ReturnType<typeof listRecentRuns>;
};
type WireFrame = SnapshotFrame | AutomationEvent;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Separate flags: a dead enqueue must never prevent cleanup from running.
      let enqueueDead = false;
      let cleanedUp = false;

      const safeEnqueue = (chunk: string): void => {
        if (enqueueDead || cleanedUp) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          enqueueDead = true;
        }
      };

      const send = (frame: WireFrame): void => {
        safeEnqueue(`data: ${JSON.stringify(frame)}\n\n`);
      };

      try {
        send({ type: "snapshot", runs: listRecentRuns(50) });
      } catch (err) {
        process.stderr.write(
          `[automation-runs/stream] snapshot failed: ${(err as Error).message}\n`,
        );
      }

      const unsubscribe = automationBus.subscribe((e) => send(e));

      const keepalive = setInterval(() => {
        safeEnqueue(`: ping\n\n`);
      }, KEEPALIVE_MS);

      const cleanup = (): void => {
        if (cleanedUp) return;
        cleanedUp = true;
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
      // Consumer disconnected.
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
