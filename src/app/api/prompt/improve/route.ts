import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { loadAppConfig } from "@/lib/config";
import { getAnthropicKey } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  context: z.string().optional(),
});

const SYSTEM_PROMPT =
  "You are a prompt engineer for an agentic coding system (Claude Code). Rewrite the user's prompt to be precise, actionable, and self-contained. Preserve intent. Be concise. Do NOT execute the task — only return the improved prompt. Output ONLY the rewritten prompt, no preamble, no markdown fences.";

export async function POST(req: Request): Promise<Response> {
  try {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
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

    const { prompt, context } = parsed.data;
    const { assistantModel } = loadAppConfig();

    const userContent = context
      ? `${prompt}\n\n# Project context\n${context}`
      : prompt;

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: assistantModel,
      max_tokens: 800,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const improved = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!improved) {
      return apiError("Assistant returned an empty response", 502);
    }

    return Response.json({ improved });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
