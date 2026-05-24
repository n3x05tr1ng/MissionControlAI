import "server-only";

import { apiError } from "@/lib/api/errors";
import { getProfile } from "@/lib/repos/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "profile";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const profile = getProfile(id);
    if (!profile) return apiError("Profile not found", 404);

    const portable = {
      name: profile.name,
      description: profile.description,
      icon: profile.icon,
      color: profile.color,
      systemPrompt: profile.systemPrompt,
      model: profile.model,
      allowedTools: profile.allowedTools,
      mcpServers: profile.mcpServers,
      permissionMode: profile.permissionMode,
      costCapUsd: profile.costCapUsd,
      timeCapSeconds: profile.timeCapSeconds,
      sandbox: profile.sandbox,
    };

    const filename = `${safeFilename(profile.name)}.profile.json`;
    return new Response(JSON.stringify(portable, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return apiError((err as Error).message);
  }
}
