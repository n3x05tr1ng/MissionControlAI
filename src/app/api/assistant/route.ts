import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import {
  chat,
  DEFAULT_SYSTEM_PROMPT,
  stringifyToolOutput,
} from "@/lib/assistant/client";
import { loadAppConfig } from "@/lib/config";
import type { AssistantMessageRow } from "@/lib/contracts";
import {
  insertAssistantMessage,
  listMessagesForConversation,
} from "@/lib/repos/assistantMessages";
import { hasAnthropicKey } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "message is required"),
});

function persistRow(row: AssistantMessageRow): void {
  try {
    insertAssistantMessage(row);
  } catch (err) {
    process.stderr.write(
      `[assistant.persist] ${(err as Error).message}\n`,
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!hasAnthropicKey()) {
    return apiError(
      "ANTHROPIC_API_KEY not configured. Open /settings to add it.",
      400,
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(`Invalid body: ${parsed.error.message}`, 400);
  }

  const conversationId =
    parsed.data.conversationId && parsed.data.conversationId.length > 0
      ? parsed.data.conversationId
      : crypto.randomUUID();
  const message = parsed.data.message;

  const history = listMessagesForConversation(conversationId);

  // El historial se reconstruye ordenando por created_at; usamos timestamps
  // estrictamente crecientes dentro de la petición para que un empate de
  // milisegundo no desordene el par assistant → tool_result.
  let lastTs = 0;
  const nextTimestamp = (): string => {
    lastTs = Math.max(Date.now(), lastTs + 1);
    return new Date(lastTs).toISOString();
  };

  persistRow({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    role: "user",
    content: JSON.stringify([{ type: "text", text: message }]),
    created_at: nextTimestamp(),
  });

  const { assistantModel } = loadAppConfig();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (payload: unknown): void => {
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      };

      try {
        for await (const ev of chat({
          conversationId,
          userMessage: message,
          history,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          model: assistantModel,
        })) {
          if (ev.kind === "text") {
            send({ kind: "text", text: ev.text });
            continue;
          }

          if (ev.kind === "tool_use") {
            // Solo se emite a la UI; la persistencia llega con assistant_turn,
            // que incluye los bloques tool_use dentro del turno assistant.
            send({
              kind: "tool_use",
              id: ev.id,
              name: ev.name,
              input: ev.input,
            });
            continue;
          }

          if (ev.kind === "assistant_turn") {
            persistRow({
              id: crypto.randomUUID(),
              conversation_id: conversationId,
              role: "assistant",
              content: JSON.stringify(ev.blocks),
              created_at: nextTimestamp(),
            });
            continue;
          }

          if (ev.kind === "tool_result") {
            persistRow({
              id: crypto.randomUUID(),
              conversation_id: conversationId,
              role: "tool",
              content: JSON.stringify([
                {
                  type: "tool_result",
                  tool_use_id: ev.id,
                  content: stringifyToolOutput(ev.output),
                },
              ]),
              created_at: nextTimestamp(),
            });
            send({
              kind: "tool_result",
              id: ev.id,
              name: ev.name,
              output: ev.output,
            });
            continue;
          }

          if (ev.kind === "error") {
            send({ kind: "error", message: ev.message });
            continue;
          }

          if (ev.kind === "done") {
            send({ kind: "done" });
          }
        }
      } catch (err) {
        send({ kind: "error", message: (err as Error).message });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Conversation-Id": conversationId,
    },
  });
}
