import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AssistantMessageRow } from "@/lib/contracts";
import { getAnthropicKey } from "@/lib/settings";

import { executeTool, toolDefinitions } from "@/lib/assistant/tools";

export type ChatEvent =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; id: string; name: string; input: unknown }
  | { kind: "tool_result"; id: string; name: string; output: unknown }
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
          pendingToolResults.push(block as unknown as ContentBlockParam);
        }
      }
      continue;
    }

    if (row.role === "user") {
      flushToolResults();
      messages.push({ role: "user", content: blocks });
      continue;
    }

    if (row.role === "assistant") {
      flushToolResults();
      messages.push({ role: "assistant", content: blocks });
    }
  }

  flushToolResults();
  return messages;
}

function stringifyToolOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
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
    const toolResultBlocks: ContentBlockParam[] = [];

    for (const block of response.content as ContentBlock[]) {
      if (block.type === "text") {
        yield { kind: "text", text: block.text };
        assistantBlocks.push({ type: "text", text: block.text });
        continue;
      }

      if (block.type === "tool_use") {
        const useBlock = block;
        yield {
          kind: "tool_use",
          id: useBlock.id,
          name: useBlock.name,
          input: useBlock.input,
        };
        assistantBlocks.push({
          type: "tool_use",
          id: useBlock.id,
          name: useBlock.name,
          input: useBlock.input,
        });

        const output = await executeTool(useBlock.name, useBlock.input);
        yield {
          kind: "tool_result",
          id: useBlock.id,
          name: useBlock.name,
          output,
        };
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: useBlock.id,
          content: stringifyToolOutput(output),
        });
      }
    }

    if (assistantBlocks.length > 0) {
      messages.push({ role: "assistant", content: assistantBlocks });
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
