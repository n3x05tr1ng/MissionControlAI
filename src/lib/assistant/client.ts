import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AssistantMessageRow } from "@/lib/contracts";
import { getAnthropicKey } from "@/lib/settings";

import { executeTool, toolDefinitions } from "@/lib/assistant/tools";

export type ChatEvent =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; id: string; name: string; input: unknown }
  | { kind: "tool_result"; id: string; name: string; output: unknown }
  // Turno assistant completo (texto + bloques tool_use) tal cual se envió a la
  // API, para que el caller lo persista sin perder los tool_use.
  | { kind: "assistant_turn"; blocks: Anthropic.ContentBlockParam[] }
  | { kind: "done" }
  | { kind: "error"; message: string };

export interface ChatOptions {
  conversationId: string;
  userMessage: string;
  history: AssistantMessageRow[];
  systemPrompt: string;
  model: string;
}

const MAX_TOKENS = 4096;
const MAX_LOOPS = 10;

export const DEFAULT_SYSTEM_PROMPT =
  "You are the Hive Assistant — a calm, concise advisor over the user's project portfolio. You can read project state, parse handoffs, create reminders, and trigger Engine runs via tools. Recurring work is modeled as tasks with a schedule on the board (not workflows). Be proactive: when a project is `blocked` or `needs-input`, offer the smallest next step. Never speculate about file contents you haven't fetched. When you take an action via a tool, summarise what you did in 1-2 lines.";

// Anthropic SDK content blocks are typed loosely (`input: unknown`). We narrow
// at the edge with these helpers so the rest of the file stays strict.
type MessageParam = Anthropic.MessageParam;
type ContentBlock = Anthropic.ContentBlock;
type ContentBlockParam = Anthropic.ContentBlockParam;

interface PersistedBlock {
  type: string;
  [key: string]: unknown;
}

function parseStoredContent(raw: string): ContentBlockParam[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as ContentBlockParam[];
    }
  } catch {
    // fall through
  }
  return [{ type: "text", text: raw }];
}

export function stringifyToolOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

// La API exige tool_result con forma { type, tool_use_id, content }. Las filas
// antiguas guardaban { tool_use_id, name, output }; las convertimos aquí.
function normalizeToolResult(block: PersistedBlock): ContentBlockParam | null {
  const toolUseId =
    typeof block.tool_use_id === "string" ? block.tool_use_id : null;
  if (!toolUseId) return null;
  const content =
    typeof block.content === "string"
      ? block.content
      : stringifyToolOutput(block.output);
  return { type: "tool_result", tool_use_id: toolUseId, content };
}

// Contrato de la API: cada tool_use de un mensaje assistant debe tener su
// tool_result en el mensaje user inmediatamente posterior, y viceversa.
// Los bloques huérfanos (p. ej. historiales cortados a media vuelta de
// herramientas) se descartan para no invalidar la conversación entera.
function dropOrphanToolBlocks(messages: MessageParam[]): MessageParam[] {
  const result: MessageParam[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (!Array.isArray(msg.content)) {
      result.push(msg);
      continue;
    }

    if (msg.role === "assistant") {
      const next = messages[i + 1];
      const resultIds = new Set<string>();
      if (next?.role === "user" && Array.isArray(next.content)) {
        for (const block of next.content) {
          if (block.type === "tool_result") resultIds.add(block.tool_use_id);
        }
      }
      const content = msg.content.filter(
        (block) => block.type !== "tool_use" || resultIds.has(block.id),
      );
      if (content.length > 0) result.push({ role: "assistant", content });
      continue;
    }

    const prev = result[result.length - 1];
    const useIds = new Set<string>();
    if (prev?.role === "assistant" && Array.isArray(prev.content)) {
      for (const block of prev.content) {
        if (block.type === "tool_use") useIds.add(block.id);
      }
    }
    const content = msg.content.filter(
      (block) => block.type !== "tool_result" || useIds.has(block.tool_use_id),
    );
    if (content.length > 0) result.push({ role: "user", content });
  }

  return result;
}

function historyToMessages(history: AssistantMessageRow[]): MessageParam[] {
  const messages: MessageParam[] = [];
  let pendingToolResults: ContentBlockParam[] = [];

  const flushToolResults = (): void => {
    if (pendingToolResults.length === 0) return;
    messages.push({ role: "user", content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const row of history) {
    const blocks = parseStoredContent(row.content);

    if (row.role === "tool") {
      for (const block of blocks as unknown as PersistedBlock[]) {
        if (block.type === "tool_result") {
          const normalized = normalizeToolResult(block);
          if (normalized) pendingToolResults.push(normalized);
          continue;
        }
        // Filas antiguas que guardaban el tool_use como role='tool': lo
        // restauramos como turno assistant para que el tool_result que sigue
        // tenga su pareja.
        if (block.type === "tool_use") {
          flushToolResults();
          messages.push({
            role: "assistant",
            content: [block as unknown as ContentBlockParam],
          });
        }
      }
      continue;
    }

    flushToolResults();
    messages.push({ role: row.role, content: blocks });
  }

  flushToolResults();
  return dropOrphanToolBlocks(messages);
}

export async function* chat(
  opts: ChatOptions,
): AsyncGenerator<ChatEvent, void, void> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    yield { kind: "error", message: "ANTHROPIC_API_KEY not configured" };
    return;
  }

  const client = new Anthropic({ apiKey });

  const messages: MessageParam[] = historyToMessages(opts.history);
  messages.push({
    role: "user",
    content: [{ type: "text", text: opts.userMessage }],
  });

  for (let loop = 0; loop < MAX_LOOPS; loop += 1) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: opts.model,
        max_tokens: MAX_TOKENS,
        system: opts.systemPrompt,
        messages,
        tools: toolDefinitions as unknown as Anthropic.Tool[],
      });
    } catch (err) {
      yield { kind: "error", message: (err as Error).message };
      return;
    }

    const assistantBlocks: ContentBlockParam[] = [];
    const toolUses: { id: string; name: string; input: unknown }[] = [];

    for (const block of response.content as ContentBlock[]) {
      if (block.type === "text") {
        yield { kind: "text", text: block.text };
        assistantBlocks.push({ type: "text", text: block.text });
        continue;
      }

      if (block.type === "tool_use") {
        yield {
          kind: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
        assistantBlocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });
        toolUses.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    if (assistantBlocks.length > 0) {
      messages.push({ role: "assistant", content: assistantBlocks });
      yield { kind: "assistant_turn", blocks: assistantBlocks };
    }

    const toolResultBlocks: ContentBlockParam[] = [];
    for (const use of toolUses) {
      const output = await executeTool(use.name, use.input);
      yield { kind: "tool_result", id: use.id, name: use.name, output };
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: stringifyToolOutput(output),
      });
    }

    if (response.stop_reason === "tool_use" && toolResultBlocks.length > 0) {
      messages.push({ role: "user", content: toolResultBlocks });
      continue;
    }

    yield { kind: "done" };
    return;
  }

  yield {
    kind: "error",
    message: `Assistant exceeded ${MAX_LOOPS} tool-use loops`,
  };
}
