import "server-only";

import { apiError } from "@/lib/api/errors";
import type { AssistantRole } from "@/lib/contracts";
import { listMessagesForConversation } from "@/lib/repos/assistantMessages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type CleanBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; output: unknown };

export interface CleanMessage {
  role: AssistantRole;
  blocks: CleanBlock[];
  createdAt: string;
}

function parseBlocks(raw: string): CleanBlock[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ type: "text", text: raw }];
  }

  if (!Array.isArray(parsed)) return [];

  const out: CleanBlock[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = rec.type;

    if (type === "text" && typeof rec.text === "string") {
      out.push({ type: "text", text: rec.text });
      continue;
    }

    if (type === "tool_use") {
      out.push({
        type: "tool_use",
        id: typeof rec.id === "string" ? rec.id : "",
        name: typeof rec.name === "string" ? rec.name : "",
        input: rec.input,
      });
      continue;
    }

    if (type === "tool_result") {
      out.push({
        type: "tool_result",
        id:
          typeof rec.tool_use_id === "string"
            ? rec.tool_use_id
            : typeof rec.id === "string"
              ? rec.id
              : "",
        name: typeof rec.name === "string" ? rec.name : "",
        output: rec.output ?? rec.content,
      });
    }
  }
  return out;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  try {
    const { conversationId } = await ctx.params;
    const rows = listMessagesForConversation(conversationId);
    const messages: CleanMessage[] = rows.map((row) => ({
      role: row.role,
      blocks: parseBlocks(row.content),
      createdAt: row.created_at,
    }));
    return Response.json({ conversationId, messages });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
