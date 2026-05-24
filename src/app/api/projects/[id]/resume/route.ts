import "server-only";

import { z } from "zod";

import { apiError } from "@/lib/api/errors";
import { loadProjectsConfig } from "@/lib/config";
import { startRun } from "@/lib/engine/runner";
import { hasAnthropicKey } from "@/lib/settings";

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

const RESUME_PREFIX =
  "Resume the previous session. Read .claude/handoff.md first.\n\n";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;

    if (!hasAnthropicKey()) {
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

    // v0.1 stub: prepend a resume instruction. Real SDK session resumption
    // arrives in Wave 4 once we plumb through `Options.resume`.
    const flags = {
      ...parsed.data.flags,
      finalPrompt: `${RESUME_PREFIX}${parsed.data.flags.finalPrompt}`,
    };

    const { sessionId } = await startRun(id, flags);
    return Response.json({ ok: true, sessionId });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
