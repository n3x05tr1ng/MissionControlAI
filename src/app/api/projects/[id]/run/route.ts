import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { loadProjectsConfig } from "@/lib/config";
import { startRun } from "@/lib/engine/runner";
import { getEngineProvider, hasAnthropicKey } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const launchFlagsSchema = z.object({
  rawPrompt: z.string(),
  finalPrompt: z.string(),
  planMode: z.boolean(),
  useSubagents: z.boolean(),
  model: z.string(),
  allowedTools: z.array(z.string()),
});

const bodySchema = z.object({ flags: launchFlagsSchema });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;

    // The API key is required only when the engine provider is the SDK-based
    // `claude-code`. The default `claude-cli` provider reuses the user's local
    // Claude Code subscription via the `claude` binary and needs no key.
    if (getEngineProvider() === "claude-code" && !hasAnthropicKey()) {
      return apiError(
        "ANTHROPIC_API_KEY not configured. Open /settings to add it.",
        400,
      );
    }

    const { projects } = loadProjectsConfig();
    if (!projects.find((p) => p.id === id)) {
      return apiError("Project not found", 404);
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

    const { sessionId } = await startRun(id, parsed.data.flags);
    return Response.json({ ok: true, sessionId });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
