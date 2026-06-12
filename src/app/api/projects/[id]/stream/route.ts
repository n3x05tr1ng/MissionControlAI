import "server-only";

import type { AgentEvent } from "@/lib/contracts";
import { getBuffer, subscribe } from "@/lib/engine/sessionBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
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

      const sendEvent = (e: AgentEvent): void => {
        safeEnqueue(`data: ${JSON.stringify(e)}\n\n`);
      };

      // Replay buffered history.
      for (const ev of getBuffer(id)) sendEvent(ev);

      const unsubscribe = subscribe(id, sendEvent);

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
      // Stream consumer disconnected. The `start` cleanup will run via the
      // abort listener; nothing else to do here.
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
